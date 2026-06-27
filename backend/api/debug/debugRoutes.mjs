import { Router } from "express";
import { env } from "../../src/config/env.mjs";
import { getEmailConfigStatus, sendTestEmail } from "../../services/security-service/authService.mjs";
import { logInfo, logWarn } from "../../src/utils/logger.mjs";

const router = Router();

/**
 * GET /api/debug/email-status
 * Returns email configuration status without exposing secrets.
 * Use this to verify SMTP setup locally or on Render.
 */
router.get("/email-status", (_req, res) => {
  try {
    const status = getEmailConfigStatus();
    logInfo("[DEBUG] Email status checked", {
      emailEnabled: status.emailEnabled,
      previewMode: status.previewMode,
    });
    res.json({
      status: "ok",
      ts: new Date().toISOString(),
      ...status,
      // NEVER expose the password — even masked
      hasPassword: status.hasPassword,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error?.message || "Failed to get email status",
    });
  }
});

/**
 * POST /api/debug/send-test-email
 * Sends a test email to verify SMTP configuration.
 * Body: { to: "email@example.com" }
 */
router.post("/send-test-email", async (req, res) => {
  try {
    const to = String(req.body?.to || "").trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      res.status(400).json({
        status: "error",
        message: "Valid email address required in 'to' field",
      });
      return;
    }

    logInfo("[DEBUG] Test email requested", { to: to.split("@")[0].slice(0, 2) + "***@" + to.split("@")[1] });
    const result = await sendTestEmail({ to });
    const httpStatus = result.success ? 200 : 502;
    res.status(httpStatus).json({
      status: result.success ? "ok" : "error",
      ts: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    logWarn("[DEBUG] Test email endpoint error", {
      message: String(error?.message || "unknown_error"),
    });
    res.status(500).json({
      status: "error",
      message: error?.message || "Failed to send test email",
    });
  }
});

/**
 * GET /api/debug/env-check
 * Returns presence status of critical env vars (never exposes values).
 */
router.get("/env-check", (_req, res) => {
  const entries = [
    "AUTH_EMAIL_ENABLED",
    "AUTH_EMAIL_FROM",
    "AUTH_EMAIL_USER",
    "AUTH_EMAIL_APP_PASSWORD",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_REQUIRE_TLS",
    "MONGODB_URI",
    "JWT_SECRET",
    "SESSION_SECRET",
    "APP_BASE_URL",
    "BACKEND_PUBLIC_URL",
    "CORS_ORIGIN",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GROQ_API_KEY",
  ];

  const envStatus = {};
  for (const key of entries) {
    const value = process.env[key];
    envStatus[key] = Boolean(value && String(value).trim());
  }

  res.json({
    status: "ok",
    ts: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || "development",
    isRender: Boolean(String(process.env.RENDER || "").trim()) || Boolean(String(process.env.RENDER_EXTERNAL_URL || "").trim()),
    env: envStatus,
    configuredCount: Object.values(envStatus).filter(Boolean).length,
    totalCount: entries.length,
    note: "Values indicate presence only — never exposed.",
  });
});

export default router;
