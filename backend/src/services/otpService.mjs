/**
 * Shared OTP Service — functional implementation
 *
 * In-memory OTP store with optional Nodemailer email delivery.
 * Used for email verification (signup) and password reset flows.
 */
import { logInfo, logWarn } from "../utils/logger.mjs";
import { env } from "../config/env.mjs";

// ── In-memory OTP store ──────────────────────────────────────────────
const otpStore = new Map();
const OTP_EXPIRY_MS = 10 * 60_000; // 10 minutes
const CLEANUP_INTERVAL_MS = 60_000;

const cleanupExpired = () => {
  const now = Date.now();
  for (const [email, record] of otpStore) {
    if (record.expiresAt < now) otpStore.delete(email);
  }
};
setInterval(cleanupExpired, CLEANUP_INTERVAL_MS).unref?.();

// ── Public API ───────────────────────────────────────────────────────

/**
 * Generate a 6-digit OTP and store it for the given email.
 * @returns {{ otp: string, expiresAt: number, expiresInMinutes: number }}
 */
export const createOtp = (email) => {
  const normalised = String(email || "").trim().toLowerCase();
  const expiresInMinutes = Math.round(OTP_EXPIRY_MS / 60_000);
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + OTP_EXPIRY_MS;
  otpStore.set(normalised, { otp, expiresAt, createdAt: Date.now() });
  logInfo("[OTP] Created OTP", { email: normalised, expiresInMinutes });
  return { otp, expiresAt, expiresInMinutes };
};

/**
 * Verify an OTP for the given email. Returns true if valid and not expired.
 * On success the OTP is deleted (single-use).
 */
export const verifyOtp = (email, otp) => {
  const normalised = String(email || "").trim().toLowerCase();
  const record = otpStore.get(normalised);
  if (!record) return false;
  if (record.expiresAt < Date.now()) {
    otpStore.delete(normalised);
    return false;
  }
  if (record.otp !== String(otp)) return false;
  otpStore.delete(normalised);
  return true;
};

/** Get OTP expiry timestamp for an email (or null). */
export const getOtpExpiry = (email) => {
  const normalised = String(email || "").trim().toLowerCase();
  const record = otpStore.get(normalised);
  if (!record || record.expiresAt < Date.now()) return null;
  return record.expiresAt;
};

/** Peek at the OTP without consuming it (debug only). */
export const peekOtp = (email) => {
  const normalised = String(email || "").trim().toLowerCase();
  return otpStore.get(normalised)?.otp ?? null;
};

/** Delete the OTP for an email. */
export const deleteOtp = (email) => {
  const normalised = String(email || "").trim().toLowerCase();
  otpStore.delete(normalised);
};

/**
 * Send an OTP email via Nodemailer. Throws if SMTP is not configured.
 */
export const sendOtpEmail = async (email, otp, expiresInMinutes = 10) => {
  if (!isMailConfigured()) {
    throw Object.assign(
      new Error("Email service is not configured. Cannot send OTP."),
      { status: 503, code: "otp_email_disabled" }
    );
  }

  const { default: nodemailer } = await import("nodemailer");

  const transporter = nodemailer.createTransport({
    host: env.smtpHost || "smtp.gmail.com",
    port: Number(env.smtpPort) || 587,
    secure: Boolean(env.smtpSecure),
    requireTLS: Boolean(env.smtpRequireTls),
    ignoreTLS: false,
    auth: {
      user: env.authEmailUser,
      pass: env.authEmailAppPassword,
    },
    tls: {
      ciphers: "DEFAULT:@SECLEVEL=1",
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 25_000,
  });

  const fromName = env.authEmailFromName || "ZeroDay Guardian Security";
  const fromAddress = env.authEmailFrom || env.authEmailUser;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #00d4ff, #7b2ff7); line-height: 48px; font-size: 24px; font-weight: bold; color: #0a0a0f;">Z</div>
      </div>
      <h2 style="text-align: center; color: #1a1a2e; margin-bottom: 16px;">Your Verification Code</h2>
      <p style="color: #555; font-size: 15px; line-height: 1.6;">Use the code below to verify your email address. This code expires in <strong>${expiresInMinutes} minutes</strong>.</p>
      <div style="text-align: center; margin: 32px 0;">
        <span style="display: inline-block; font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #7b2ff7; font-family: 'Courier New', monospace; padding: 16px 32px; background: #f8f7ff; border-radius: 12px; border: 2px dashed #7b2ff7;">${otp}</span>
      </div>
      <p style="color: #888; font-size: 13px; text-align: center;">If you did not request this code, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #aaa; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} ZeroDay Guardian Security</p>
    </div>
  `;

  const textBody = `Your ZeroDay Guardian verification code is: ${otp}\nThis code expires in ${expiresInMinutes} minutes.\nIf you did not request this code, you can safely ignore this email.`;

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: email,
      subject: `Your ZeroDay Guardian Verification Code: ${otp}`,
      text: textBody,
      html: htmlBody,
    });
    logInfo("[OTP] Email sent", { email, messageId: info.messageId });
    transporter.close();
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logWarn("[OTP] Email send failed", { email, error: error.message });
    transporter.close();
    throw Object.assign(
      new Error("Failed to send verification email. Please try again."),
      { status: 502, code: "otp_email_send_failed" }
    );
  }
};

/** Check if the mail transport is configured. */
export const isMailConfigured = () =>
  Boolean(env.authEmailEnabled && env.authEmailUser && env.authEmailAppPassword && env.authEmailFrom);

/** Express handler — send OTP. */
export const sendOtpHandler = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ status: "error", code: "missing_email", message: "Email is required." });
    }
    const { otp, expiresInMinutes } = createOtp(email);
    await sendOtpEmail(email, otp, expiresInMinutes);
    res.json({ status: "ok", message: "Verification code sent.", expiresInMinutes });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ status: "error", code: error.code || "otp_send_failed", message: error.message });
  }
};

/** Express handler — verify OTP. */
export const verifyOtpHandler = (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) {
    return res.status(400).json({ status: "error", code: "missing_fields", message: "Email and OTP are required." });
  }
  const valid = verifyOtp(email, otp);
  if (!valid) {
    return res.status(400).json({ status: "error", code: "otp_invalid", message: "Invalid or expired verification code." });
  }
  res.json({ status: "ok", verified: true });
};

/** Express handler — OTP health check. */
export const otpHealthHandler = (_req, res) => {
  res.json({ status: "ok", activeOtps: otpStore.size, mailConfigured: isMailConfigured() });
};

/** Get count of active OTPs. */
export const getActiveOtpCount = () => otpStore.size;
