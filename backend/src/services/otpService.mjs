/**
 * Shared OTP Service
 *
 * Provides OTP generation, in-memory storage (with optional MongoDB persistence),
 * Gmail/SMTP email sending, and OTP verification.
 *
 * Used by:
 *  - authService.mjs (sendResetOtp / resetPassword)
 *  - scripts/otp-server.mjs (standalone OTP server)
 *  - OTP route handlers (mounted in app.mjs)
 */
import nodemailer from "nodemailer";
import { env } from "../config/env.mjs";
import { logInfo, logWarn } from "../utils/logger.mjs";

// ── In-memory OTP store ──
const otpStore = new Map();
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 30_000;

// Start cleanup timer (non-blocking, allows process to exit)
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of otpStore.entries()) {
    if (!entry || Number(entry.expiresAt || 0) <= now) {
      otpStore.delete(email);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

// ── Helpers ──

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();

const isValidEmail = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const maskEmail = (value = "") => {
  const [local, domain] = String(value || "").split("@");
  if (!local || !domain) return value;
  const visibleLocal =
    local.length <= 2
      ? `${local[0] || "*"}*`
      : `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}`;
  return `${visibleLocal}@${domain}`;
};

const brandedFromField = () => {
  const email = String(env.authEmailFrom || env.authEmailUser || "").trim();
  const name = String(env.authEmailFromName || "ZeroDay Guardian Security").trim();
  return name && email ? `"${name.replace(/"/g, "")}" <${email}>` : email;
};

const mailConfigured = () =>
  Boolean(env.authEmailEnabled && env.authEmailUser && env.authEmailAppPassword && env.authEmailFrom);

let transporterPromise = null;

const getMailTransporter = async () => {
  if (!mailConfigured()) {
    throw Object.assign(new Error("Email service is not configured"), {
      status: 500,
      code: "mail_not_configured",
    });
  }
  if (!transporterPromise) {
    logInfo("[OTP] Creating nodemailer transport", {
      host: env.smtpHost,
      port: env.smtpPort,
      user: env.authEmailUser,
      from: brandedFromField(),
    });
    transporterPromise = (async () => {
      const transporter = nodemailer.createTransport({
        host: env.smtpHost || "smtp.gmail.com",
        port: Number(env.smtpPort) || 587,
        secure: env.smtpSecure === true,
        auth: {
          user: env.authEmailUser,
          pass: env.authEmailAppPassword,
        },
        requireTLS: env.smtpRequireTls !== false,
        connectionTimeout: 5_000,
        greetingTimeout: 5_000,
        socketTimeout: 25_000, // Must exceed sendMail timeout (20s) to let Promise.race be the effective timeout
      });
      const VERIFY_TIMEOUT_MS = 5_000;
      try {
        await Promise.race([
          transporter.verify(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`SMTP verify timed out after ${VERIFY_TIMEOUT_MS}ms`)), VERIFY_TIMEOUT_MS)
          ),
        ]);
        logInfo("[OTP] SMTP transport verified successfully", {
          host: env.smtpHost,
          user: maskEmail(env.authEmailUser),
        });
      } catch (verifyError) {
        logWarn("[OTP] SMTP transport verification failed — sendMail will still be attempted", {
          error: String(verifyError?.message || verifyError),
        });
      }
      return transporter;
    })();
  }
  return transporterPromise;
};

// ── Public API ──

/**
 * Generate and store an OTP for the given email.
 * Stores in both in-memory Map and (if available) the user's MongoDB document.
 *
 * @param {string} email
 * @returns {{ otp: string, expiresAt: number, expiresInMinutes: number }}
 */
export const createOtp = (email) => {
  const safeEmail = normalizeEmail(email);
  const otp = generateOtp();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;
  const expiresInMinutes = Math.round(OTP_EXPIRY_MS / 60000);

  otpStore.set(safeEmail, { otp, expiresAt });

  logInfo("[OTP] Created OTP", {
    email: maskEmail(safeEmail),
    expiresInMinutes,
  });

  return { otp, expiresAt, expiresInMinutes };
};

/**
 * Verify an OTP for the given email.
 * Checks in-memory store first. On success, deletes the OTP from memory.
 *
 * @param {string} email
 * @param {string} otp
 * @returns {boolean} true if valid
 */
export const verifyOtp = (email, otp) => {
  const safeEmail = normalizeEmail(email);
  const safeOtp = String(otp || "").trim();

  const entry = otpStore.get(safeEmail);
  if (!entry) return false;

  if (Number(entry.expiresAt) <= Date.now()) {
    otpStore.delete(safeEmail);
    return false;
  }

  if (entry.otp !== safeOtp) return false;

  // Valid — consume the OTP
  otpStore.delete(safeEmail);
  return true;
};

/**
 * Get OTP expiry timestamp for an email (from in-memory store).
 * @param {string} email
 * @returns {number|null}
 */
export const getOtpExpiry = (email) => {
  const safeEmail = normalizeEmail(email);
  const entry = otpStore.get(safeEmail);
  return entry ? Number(entry.expiresAt) : null;
};

/**
 * Peek at the stored OTP (for development preview mode).
 * @param {string} email
 * @returns {string|null}
 */
export const peekOtp = (email) => {
  const safeEmail = normalizeEmail(email);
  const entry = otpStore.get(safeEmail);
  return entry ? entry.otp : null;
};

/**
 * Delete an OTP from memory (e.g., after reset completes via MongoDB path).
 * @param {string} email
 */
export const deleteOtp = (email) => {
  const safeEmail = normalizeEmail(email);
  otpStore.delete(safeEmail);
};

/**
 * Send an OTP email via SMTP.
 *
 * @param {string} email
 * @param {string} otp
 * @param {number} expiresInMinutes
 * @returns {Promise<void>}
 */
export const sendOtpEmail = async (email, otp, expiresInMinutes) => {
  const safeEmail = normalizeEmail(email);

  if (!mailConfigured()) {
    throw Object.assign(
      new Error("Email service is not configured"),
      { status: 500, code: "mail_not_configured" }
    );
  }

  const transporter = await getMailTransporter();
  const safeOtp = String(otp || "").trim();
  const SENDMAIL_TIMEOUT_MS = 20_000; // Gmail SMTP can be slow — 20s to allow for delivery

  logInfo("[OTP] Sending OTP email via SMTP", {
    email: maskEmail(safeEmail),
    host: env.smtpHost,
    expiresInMinutes,
  });
  try {
    const sendMailPromise = transporter.sendMail({
        from: brandedFromField(),
        to: safeEmail,
        subject: "ZeroDay Guardian Security | Password Reset Verification Code",
        text: [
          "ZeroDay Guardian Security",
          "",
          `Your password reset verification code is: ${safeOtp}`,
          `This code expires in ${expiresInMinutes} minutes.`,
          "",
          "If you requested this reset, enter the code in the app to continue.",
          "If you did not request a password reset, you can safely ignore this email.",
          "",
          `${env.appBaseUrl}`,
        ].join("\n"),
        html: `
      <div style="margin:0;padding:24px;background:#f3f6fb;font-family:Arial,sans-serif;color:#0f172a">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dbe4f0;border-radius:16px;overflow:hidden">
          <div style="padding:20px 24px;background:linear-gradient(135deg,#0f172a,#0f766e);color:#ffffff">
            <div style="font-size:12px;letter-spacing:1.2px;text-transform:uppercase;opacity:.82">ZeroDay Guardian Security</div>
            <h2 style="margin:8px 0 0;font-size:22px;line-height:1.3">Password Reset Verification</h2>
          </div>
          <div style="padding:24px">
            <p style="margin:0 0 14px;font-size:14px;line-height:1.6">Use the verification code below to continue your password reset request.</p>
            <div style="margin:18px 0;padding:18px;border:1px dashed #94a3b8;border-radius:14px;background:#f8fafc;text-align:center">
              <div style="font-size:30px;font-weight:700;letter-spacing:8px;color:#0f172a">${safeOtp}</div>
            </div>
            <p style="margin:0 0 10px;font-size:14px;line-height:1.6">This code expires in <strong>${expiresInMinutes} minutes</strong>.</p>
            <p style="margin:0 0 10px;font-size:14px;line-height:1.6">If you did not request a password reset, you can safely ignore this email and your account will remain unchanged.</p>
            <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#475569">Requested from ZeroDay Guardian Security</p>
          </div>
        </div>
      </div>`.trim(),
      });
    await Promise.race([
      sendMailPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`SMTP sendMail timed out after ${SENDMAIL_TIMEOUT_MS}ms`)), SENDMAIL_TIMEOUT_MS)
      ),
    ]);
    // Suppress any late rejection after the race is settled
    sendMailPromise.catch(() => {});
  } catch (sendError) {
    // Re-throw so the caller (authService.sendResetOtp) can handle it
    throw sendError;
  }

  logInfo("[OTP] Email sent successfully", {
    email: maskEmail(safeEmail),
    host: env.smtpHost,
    from: brandedFromField(),
  });
};

/**
 * Check if SMTP is configured for sending emails.
 * @returns {boolean}
 */
export const isMailConfigured = () => mailConfigured();

/**
 * Express route handler: POST /send
 * Generates OTP, stores in memory, sends via email.
 */
export const sendOtpHandler = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) {
    res.status(400).json({ status: "error", message: "Valid email is required." });
    return;
  }

  const { otp, expiresInMinutes } = createOtp(email);

  if (!mailConfigured()) {
    if (env.authOtpPreviewEnabled) {
      logWarn("[OTP] Email not configured — returning OTP in preview mode", {
        email: maskEmail(email),
        delivery: "preview",
      });
      res.json({
        status: "ok",
        sent: false,
        delivery: "preview",
        destination: maskEmail(email),
        expiresInMinutes,
        message: `Email service is not configured. OTP would have been sent to ${maskEmail(email)}.`,
        otp, // exposed for development
      });
      return;
    }
    res.status(503).json({
      status: "error",
      message: "Email service is not configured. Cannot send verification email.",
      code: "mail_not_configured",
    });
    return;
  }

  try {
    await sendOtpEmail(email, otp, expiresInMinutes);
    res.json({
      status: "ok",
      sent: true,
      delivery: "email",
      destination: maskEmail(email),
      expiresInMinutes,
      message: "Verification code sent successfully.",
    });
  } catch (error) {
    logWarn("[OTP] Email delivery failed — falling back to preview mode", {
      email: maskEmail(email),
      error: String(error?.message || "timeout"),
      fallback: "preview",
    });
    // Return preview fallback when authOtpPreviewEnabled is true
    // so the client can still complete the password reset flow
    if (env.authOtpPreviewEnabled) {
      res.json({
        status: "ok",
        sent: false,
        delivery: "preview",
        destination: maskEmail(email),
        expiresInMinutes,
        message: "Email delivery temporarily unavailable. The reset code can still be verified via the stored OTP.",
        otp, // exposed for development/preview so the user can still reset
      });
      return;
    }
    deleteOtp(email);
    res.status(502).json({
      status: "error",
      message: "Failed to send verification email.",
      code: "mail_delivery_failed",
      error: String(error?.message || "unknown_error"),
    });
  }
};

/**
 * Express route handler: POST /verify
 * Validates OTP against in-memory store.
 */
export const verifyOtpHandler = (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const otp = String(req.body?.otp || "").trim();

  if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
    res.status(400).json({ status: "error", message: "Valid email and 6-digit OTP are required." });
    return;
  }

  const valid = verifyOtp(email, otp);
  if (!valid) {
    res.status(400).json({ status: "error", message: "Invalid or expired OTP." });
    return;
  }

  res.json({ status: "ok", message: "OTP verified successfully." });
};

/**
 * Express route handler: GET /health
 */
export const otpHealthHandler = (_req, res) => {
  res.json({ status: "ok", activeOtps: otpStore.size });
};

/**
 * Get the number of active OTPs in memory.
 * @returns {number}
 */
export const getActiveOtpCount = () => otpStore.size;
