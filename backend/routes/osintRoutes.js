import { Router } from "express";
import PDFDocument from "pdfkit";
import net from "node:net";
import { z } from "zod";
import { requireAuth } from "../src/middleware/auth.mjs";
import { validateBody, validateParams, validateQuery } from "../src/middleware/validate.mjs";
import {
  osintAlertListSchema,
  osintCaseCreateSchema,
  osintCaseListSchema,
  osintCaseUpdateSchema,
  osintProvidersSchema,
  osintResolveSchema,
  osintWatchlistCreateSchema,
  osintWatchlistUpdateSchema,
} from "../src/validators/osintSchemas.mjs";
import { getOsintProviders, resolveOsint, scanDomainOsint, scanEmailOsint, scanIpOsint } from "../src/services/osintService.mjs";
import { addEntity, createCase, createShare, getCaseById, getSharedCase, listCases, updateCase } from "../src/services/osintCaseService.mjs";
import { createWatchlist, deleteWatchlist, listAlerts, listWatchlists, runWatchlistScan, updateWatchlist } from "../src/services/osintWatchlistService.mjs";
import { logError, logInfo } from "../src/utils/logger.mjs";

const router = Router();

const emailScanSchema = z.object({
  email: z.string().trim().email().max(254),
});

const domainScanSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^(?=.{1,255}$)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,63}$/, "Provide a valid domain."),
});

const ipScanSchema = z.object({
  ip: z.string().trim().min(1).max(64).refine((value) => net.isIP(value) !== 0, "Provide a valid IP address."),
});

const watchlistListSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional(),
});

const caseIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(200),
});

const shareIdParamsSchema = z.object({
  shareId: z.string().trim().min(1).max(200),
});

const exportParamsSchema = z.object({
  id: z.string().trim().min(1).max(200),
  format: z.string().trim().min(1).max(16),
});

const buildShareUrl = (req, shareId) => {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = String(req.get("host") || "").trim();
  return host ? `${protocol}://${host}/osint/share/${shareId}` : `/osint/share/${shareId}`;
};

const sanitizeCaseForShare = (row) => {
  if (!row) return null;
  return {
    _id: row._id?.toString?.() || "",
    title: String(row.title || ""),
    target: String(row.target || ""),
    summary: String(row.summary || ""),
    notes: String(row.notes || ""),
    folder: String(row.folder || ""),
    tags: Array.isArray(row.tags) ? row.tags : [],
    entities: Array.isArray(row.entities) ? row.entities : [],
    modules: Array.isArray(row.modules) ? row.modules : [],
    results: row.results || {},
    events: Array.isArray(row.events) ? row.events : [],
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
};

const toCsv = (row = {}) => {
  const lines = [
    ["field", "value"],
    ["title", row.title || ""],
    ["target", row.target || ""],
    ["summary", row.summary || ""],
    ["folder", row.folder || ""],
    ["tags", (row.tags || []).join("|")],
    ["entities", (row.entities || []).join("|")],
    ["modules", (row.modules || []).join("|")],
    ["notes", row.notes || ""],
    ["results", JSON.stringify(row.results || {})],
  ];
  return lines
    .map((line) =>
      line
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");
};

const sendCasePdf = (res, row) => {
  const doc = new PDFDocument({ margin: 48 });
  doc.pipe(res);
  doc.fontSize(18).text("ZeroDay Guardian OSINT Case");
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Title: ${row.title || "Untitled Case"}`);
  doc.text(`Target: ${row.target || ""}`);
  doc.text(`Folder: ${row.folder || "n/a"}`);
  doc.text(`Tags: ${(row.tags || []).join(", ") || "n/a"}`);
  doc.text(`Modules: ${(row.modules || []).join(", ") || "n/a"}`);
  doc.moveDown();
  doc.fontSize(13).text("Summary");
  doc.fontSize(11).text(row.summary || "No summary provided.");
  doc.moveDown();
  doc.fontSize(13).text("Notes");
  doc.fontSize(11).text(row.notes || "No notes provided.");
  doc.moveDown();
  doc.fontSize(13).text("Entities");
  doc.fontSize(11).text((row.entities || []).join(", ") || "No entities.");
  doc.moveDown();
  doc.fontSize(13).text("Results");
  doc.fontSize(9).text(JSON.stringify(row.results || {}, null, 2), { width: 500 });
  doc.end();
};

const wrap = (label, handler) => async (req, res, next) => {
  try {
    logInfo(`OSINT route ${label}`, {
      requestId: req.requestId || "",
      method: req.method,
      path: req.originalUrl || req.path,
      userId: req.user?.sub || "",
    });
    await handler(req, res, next);
  } catch (error) {
    logError(`OSINT route ${label} failed`, error, {
      requestId: req.requestId || "",
      method: req.method,
      path: req.originalUrl || req.path,
      userId: req.user?.sub || "",
    });
    next(error);
  }
};

router.get("/providers", validateQuery(osintProvidersSchema), wrap("providers", async (_req, res) => {
  res.json({ status: "ok", providers: getOsintProviders() });
}));

router.get("/share/:shareId", validateParams(shareIdParamsSchema), wrap("share_get", async (req, res) => {
  const shareId = String(req.validatedParams.shareId || "").trim();
  if (!shareId) {
    res.status(400).json({ status: "error", code: "invalid_share_id", error: "Share id is required" });
    return;
  }
  const row = await getSharedCase({ shareId });
  if (!row) {
    res.status(404).json({ status: "error", code: "shared_case_not_found", error: "Shared case not found" });
    return;
  }
  res.json({ status: "ok", case: sanitizeCaseForShare(row) });
}));

router.post("/resolve", requireAuth, validateBody(osintResolveSchema), wrap("resolve", async (req, res) => {
  const result = await resolveOsint(req.validatedBody);
  res.json(result);
}));

router.post("/email-scan", requireAuth, validateBody(emailScanSchema), wrap("email_scan", async (req, res) => {
  const result = await scanEmailOsint(req.validatedBody.email);
  res.json(result);
}));

router.post("/domain-scan", requireAuth, validateBody(domainScanSchema), wrap("domain_scan", async (req, res) => {
  const result = await scanDomainOsint(req.validatedBody.domain);
  res.json(result);
}));

router.post("/ip-scan", requireAuth, validateBody(ipScanSchema), wrap("ip_scan", async (req, res) => {
  const result = await scanIpOsint(req.validatedBody.ip);
  res.json(result);
}));

router.get("/cases", requireAuth, validateQuery(osintCaseListSchema), wrap("cases_list", async (req, res) => {
  const cases = await listCases({ ownerId: req.user.sub, limit: req.validatedQuery.limit || 40 });
  res.json({ status: "ok", cases: cases.map(sanitizeCaseForShare) });
}));

router.post("/cases", requireAuth, validateBody(osintCaseCreateSchema), wrap("cases_create", async (req, res) => {
  const row = await createCase({ ownerId: req.user.sub, ...req.validatedBody });
  res.status(201).json({ status: "ok", case: sanitizeCaseForShare(row) });
}));

router.get("/cases/:id", requireAuth, validateParams(caseIdParamsSchema), wrap("cases_get", async (req, res) => {
  const row = await getCaseById({ ownerId: req.user.sub, id: req.validatedParams.id });
  if (!row) {
    res.status(404).json({ status: "error", code: "case_not_found", error: "Case not found" });
    return;
  }
  res.json({ status: "ok", case: sanitizeCaseForShare(row) });
}));

router.patch("/cases/:id", requireAuth, validateParams(caseIdParamsSchema), validateBody(osintCaseUpdateSchema), wrap("cases_patch", async (req, res) => {
  const row = await updateCase({ ownerId: req.user.sub, id: req.validatedParams.id, patch: req.validatedBody });
  if (!row) {
    res.status(404).json({ status: "error", code: "case_not_found", error: "Case not found" });
    return;
  }
  res.json({ status: "ok", case: sanitizeCaseForShare(row) });
}));

router.post("/cases/:id/entities", requireAuth, validateParams(caseIdParamsSchema), validateBody(z.object({ entity: z.string().trim().min(1).max(200) })), wrap("cases_add_entity", async (req, res) => {
  const row = await addEntity({ ownerId: req.user.sub, id: req.validatedParams.id, entity: req.validatedBody.entity });
  if (!row) {
    res.status(404).json({ status: "error", code: "case_not_found", error: "Case not found" });
    return;
  }
  res.json({ status: "ok", case: sanitizeCaseForShare(row) });
}));

router.post("/cases/:id/share", requireAuth, validateParams(caseIdParamsSchema), wrap("cases_share", async (req, res) => {
  const row = await getCaseById({ ownerId: req.user.sub, id: req.validatedParams.id });
  if (!row) {
    res.status(404).json({ status: "error", code: "case_not_found", error: "Case not found" });
    return;
  }
  const shareId = await createShare({ ownerId: req.user.sub, id: req.validatedParams.id });
  res.json({ status: "ok", shareId, shareUrl: buildShareUrl(req, shareId) });
}));

router.get("/cases/:id/export.:format", requireAuth, validateParams(exportParamsSchema), wrap("cases_export", async (req, res) => {
  const row = await getCaseById({ ownerId: req.user.sub, id: req.validatedParams.id });
  if (!row) {
    res.status(404).json({ status: "error", code: "case_not_found", error: "Case not found" });
    return;
  }

  const format = String(req.validatedParams.format || "").trim().toLowerCase();
  if (!["csv", "pdf"].includes(format)) {
    res.status(400).json({ status: "error", code: "invalid_export_format", error: "Export format must be csv or pdf" });
    return;
  }
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="osint-case-${req.validatedParams.id}.csv"`);
    res.status(200).send(toCsv(row));
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="osint-case-${req.validatedParams.id}.pdf"`);
  sendCasePdf(res, row);
}));

router.get("/watchlists", requireAuth, validateQuery(watchlistListSchema), wrap("watchlists_list", async (req, res) => {
  const watchlists = await listWatchlists({ ownerId: req.user.sub, limit: req.validatedQuery.limit || 50 });
  res.json({ status: "ok", watchlists });
}));

router.post("/watchlists", requireAuth, validateBody(osintWatchlistCreateSchema), wrap("watchlists_create", async (req, res) => {
  const watchlist = await createWatchlist({ ownerId: req.user.sub, ...req.validatedBody });
  res.status(201).json({ status: "ok", watchlist });
}));

router.patch("/watchlists/:id", requireAuth, validateParams(caseIdParamsSchema), validateBody(osintWatchlistUpdateSchema), wrap("watchlists_patch", async (req, res) => {
  const watchlist = await updateWatchlist({ ownerId: req.user.sub, id: req.validatedParams.id, patch: req.validatedBody });
  if (!watchlist) {
    res.status(404).json({ status: "error", code: "watchlist_not_found", error: "Watchlist not found" });
    return;
  }
  res.json({ status: "ok", watchlist });
}));

router.delete("/watchlists/:id", requireAuth, validateParams(caseIdParamsSchema), wrap("watchlists_delete", async (req, res) => {
  await deleteWatchlist({ ownerId: req.user.sub, id: req.validatedParams.id });
  res.status(204).end();
}));

router.post("/watchlists/:id/run", requireAuth, validateParams(caseIdParamsSchema), wrap("watchlists_run", async (req, res) => {
  const watchlists = await listWatchlists({ ownerId: req.user.sub, limit: 100 });
  const watchlist = watchlists.find((item) => String(item?._id || "") === String(req.validatedParams.id || ""));
  if (!watchlist) {
    res.status(404).json({ status: "error", code: "watchlist_not_found", error: "Watchlist not found" });
    return;
  }
  const result = await runWatchlistScan({ ownerId: req.user.sub, watchlist });
  res.json({ status: "ok", result });
}));

router.get("/alerts", requireAuth, validateQuery(osintAlertListSchema), wrap("alerts_list", async (req, res) => {
  const alerts = await listAlerts({ ownerId: req.user.sub, limit: req.validatedQuery.limit || 40 });
  res.json({ status: "ok", alerts });
}));

export default router;
