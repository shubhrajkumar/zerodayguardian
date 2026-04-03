import { Router } from "express";
import PDFDocument from "pdfkit";
import mongoose from "mongoose";
import { validateQuery } from "../../src/middleware/validate.mjs";
import { scanSummaryQuerySchema } from "../../src/validators/scanSchemas.mjs";
import { Scan } from "../../src/models/Scan.mjs";
import { TtlCache } from "../../src/utils/ttlCache.mjs";

const router = Router();
const scanSummaryCache = new TtlCache({ ttlMs: 12_000, maxEntries: 400 });
const normalizeObjectId = (value) => {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : value;
};
const summarizeFindings = (result = {}) => {
  const findings = Array.isArray(result?.findings) ? result.findings : [];
  return findings.slice(0, 8).map((item) => ({
    title: String(item?.title || "Finding"),
    severity: String(item?.severity || "medium"),
    recommendation: String(item?.recommendation || ""),
  }));
};

router.get("/summary", validateQuery(scanSummaryQuerySchema), async (req, res, next) => {
  try {
    const userId = normalizeObjectId(req.user?.sub);
    const limit = req.validatedQuery.limit;
    if (!String(req.user?.sub || "").trim()) {
      res.status(400).json({
        status: "error",
        code: "invalid_user_id",
        message: "Authenticated user id is not valid for scan summary.",
        requestId: req.requestId || "",
      });
      return;
    }
    if (!(userId instanceof mongoose.Types.ObjectId)) {
      res.json({
        status: "ok",
        data: {
          totalScans: 0,
          riskCounts: { low: 0, medium: 0, high: 0 },
          recent: [],
        },
        meta: {
          limit,
          returned: 0,
        },
        requestId: req.requestId || "",
      });
      return;
    }
    const payload = await scanSummaryCache.getOrCreate(`${String(userId)}:${limit}`, async () => {
      const [totalScans, recent] = await Promise.all([
        Scan.countDocuments({ userId }),
        Scan.find({ userId })
          .select({
            _id: 1,
            url: 1,
            riskLevel: 1,
            risk: 1,
            createdAt: 1,
            "result.summary": 1,
            "result.notes": 1,
          })
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean(),
      ]);
      const riskCounts = recent.reduce(
        (acc, row) => {
          const level = String(row.riskLevel || row.risk || "low").toLowerCase();
          acc[level] = (acc[level] || 0) + 1;
          return acc;
        },
        { low: 0, medium: 0, high: 0 }
      );
      const recentActivity = recent.map((row) => ({
        id: row._id.toString(),
        url: row.url,
        riskLevel: String(row.riskLevel || row.risk || "low"),
        createdAt: row.createdAt,
        summary: String(row.result?.summary || row.result?.notes || "Scan completed."),
      }));
      return {
        totalScans,
        riskCounts,
        recent: recentActivity,
      };
    });
    res.json({
      status: "ok",
      data: payload,
      meta: {
        limit,
        returned: payload.recent.length,
      },
      requestId: req.requestId || "",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/report/:id", async (req, res, next) => {
  try {
    const userId = normalizeObjectId(req.user?.sub);
    const id = normalizeObjectId(req.params.id);
    if (!(userId instanceof mongoose.Types.ObjectId) || !(id instanceof mongoose.Types.ObjectId)) {
      res.status(404).json({ status: "error", code: "scan_not_found", message: "Scan not found." });
      return;
    }
    const scan = await Scan.findOne({ _id: id, userId }).lean();
    if (!scan) {
      res.status(404).json({ status: "error", code: "scan_not_found", message: "Scan not found." });
      return;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="scan-report-${scan._id}.pdf"`);
    const doc = new PDFDocument({ margin: 48 });
    doc.pipe(res);
    doc.fontSize(18).text("ZeroDay Guardian Scan Report");
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Target: ${scan.url}`);
    doc.text(`Risk: ${String(scan.riskLevel || scan.risk || "low").toUpperCase()}`);
    doc.text(`Generated: ${new Date(scan.createdAt || Date.now()).toISOString()}`);
    doc.moveDown();
    doc.fontSize(13).text("Summary");
    doc.fontSize(11).text(String(scan.result?.summary || scan.result?.notes || "No summary available."));
    doc.moveDown();
    doc.fontSize(13).text("Key Findings");
    const findings = summarizeFindings(scan.result);
    if (!findings.length) {
      doc.fontSize(11).text("No detailed findings were stored for this scan.");
    } else {
      findings.forEach((item, index) => {
        doc.fontSize(11).text(`${index + 1}. ${item.title} [${item.severity.toUpperCase()}]`);
        if (item.recommendation) doc.fontSize(10).text(`Recommendation: ${item.recommendation}`);
        doc.moveDown(0.4);
      });
    }
    doc.end();
  } catch (error) {
    next(error);
  }
});

export default router;
