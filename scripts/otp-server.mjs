/**
 * Standalone OTP Server
 *
 * Optional separate process for handling OTP email sending and verification.
 * Uses the shared OTP service from the main backend.
 *
 * Run with: node scripts/otp-server.mjs
 *
 * If you want the OTP endpoints to be part of the main backend (recommended),
 * they are already mounted at /api/otp/send, /api/otp/verify, /api/otp/health.
 */
import "../backend/src/config/env.mjs";
import express from "express";
import {
  sendOtpHandler,
  verifyOtpHandler,
  otpHealthHandler,
  getActiveOtpCount,
} from "../backend/src/services/otpService.mjs";

const app = express();
app.use(express.json());

const PORT = Number(process.env.OTP_PORT || 5050);

app.post("/send", sendOtpHandler);
app.post("/verify", verifyOtpHandler);
app.get("/health", otpHealthHandler);

// ── JSON error handler ────────────────────────────────────────────────
// Catches unexpected errors and returns JSON instead of Express's default HTML.
app.use((err, _req, res, _next) => {
  if (res.headersSent) return;
  const status = Number(err?.status || err?.statusCode || 500) >= 400
    ? Number(err?.status || err?.statusCode || 500)
    : 500;
  const code = String(err?.code || "internal_error").toLowerCase();
  const message = status >= 500
    ? "Internal server error"
    : String(err?.message || "Request failed");
  console.error("[OTP Error]", status, code, err?.message || err);
  res.status(status).json({
    status: "error",
    code,
    message,
    ...(process.env.NODE_ENV !== "production"
      ? { debug: { message: String(err?.message || err), stack: (err?.stack || "").split("\n").slice(0, 6) } }
      : {}),
  });
});

app.listen(PORT, () => {
  console.log(`[OTP Server] Listening on http://localhost:${PORT}`);
  console.log(`[OTP Server] Active OTPs: ${getActiveOtpCount()}`);
  console.log(`[OTP Server] These endpoints are also available on the main backend at /api/otp/`);
});
