import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = Number(process.env.OTP_PORT || 5050);
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const otpStore = new Map();
const gmailUser = String(process.env.GMAIL_USER || process.env.AUTH_EMAIL_USER || "").trim();
const gmailPass = String(process.env.GMAIL_PASS || process.env.AUTH_EMAIL_APP_PASSWORD || "").trim();
const mailFrom = String(process.env.AUTH_EMAIL_FROM || gmailUser || "").trim();
const mailFromName = String(process.env.AUTH_EMAIL_FROM_NAME || "ZeroDay Guardian Security").trim();
const brandedFrom = mailFromName && mailFrom ? `"${mailFromName.replace(/"/g, "")}" <${mailFrom}>` : mailFrom;

const missingEnv = [];
if (!gmailUser) missingEnv.push("GMAIL_USER");
if (!gmailPass) missingEnv.push("GMAIL_PASS");
if (!mailFrom) missingEnv.push("AUTH_EMAIL_FROM");

if (missingEnv.length) {
  throw new Error(`Missing required env vars: ${missingEnv.join(", ")}`);
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: gmailUser,
    pass: gmailPass,
  },
});

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();
const isValidEmail = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const cleanupExpiredOtps = () => {
  const now = Date.now();
  for (const [email, entry] of otpStore.entries()) {
    if (!entry || Number(entry.expiresAt || 0) <= now) otpStore.delete(email);
  }
};

setInterval(cleanupExpiredOtps, 30_000).unref();

app.post("/send", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) {
    res.status(400).json({ status: "error", message: "Valid email is required." });
    return;
  }

  const otp = generateOtp();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;
  otpStore.set(email, { otp, expiresAt });

  try {
    await transporter.sendMail({
      from: brandedFrom,
      to: email,
      subject: "ZeroDay Guardian Security | Verification Code",
      text: [
        "ZeroDay Guardian Security",
        "",
        `Your verification code is: ${otp}`,
        "This code expires in 5 minutes.",
        "",
        "If you did not request this code, you can ignore this email.",
      ].join("\n"),
      html: `
        <div style="margin:0;padding:24px;background:#f3f6fb;font-family:Arial,sans-serif;color:#0f172a">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dbe4f0;border-radius:16px;overflow:hidden">
            <div style="padding:20px 24px;background:linear-gradient(135deg,#0f172a,#0f766e);color:#ffffff">
              <div style="font-size:12px;letter-spacing:1.2px;text-transform:uppercase;opacity:.82">ZeroDay Guardian Security</div>
              <h2 style="margin:8px 0 0;font-size:22px;line-height:1.3">Email Verification</h2>
            </div>
            <div style="padding:24px">
              <p style="margin:0 0 14px;font-size:14px;line-height:1.6">Use the code below to continue securely.</p>
              <div style="margin:18px 0;padding:18px;border:1px dashed #94a3b8;border-radius:14px;background:#f8fafc;text-align:center">
                <div style="font-size:30px;font-weight:700;letter-spacing:8px;color:#0f172a">${otp}</div>
              </div>
              <p style="margin:0 0 10px;font-size:14px;line-height:1.6">This code expires in <strong>5 minutes</strong>.</p>
              <p style="margin:0;font-size:14px;line-height:1.6">If you did not request this code, you can safely ignore this email.</p>
            </div>
          </div>
        </div>`,
    });

    res.json({
      status: "ok",
      message: "OTP sent successfully.",
      email,
      expiresInSeconds: 300,
    });
  } catch (error) {
    otpStore.delete(email);
    res.status(502).json({
      status: "error",
      message: "Failed to send OTP email.",
      error: String(error?.message || "unknown_error"),
    });
  }
});

app.post("/verify", (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const otp = String(req.body?.otp || "").trim();

  if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
    res.status(400).json({ status: "error", message: "Valid email and 6-digit OTP are required." });
    return;
  }

  const entry = otpStore.get(email);
  if (!entry) {
    res.status(400).json({ status: "error", message: "OTP not found or expired." });
    return;
  }

  if (Number(entry.expiresAt || 0) <= Date.now()) {
    otpStore.delete(email);
    res.status(400).json({ status: "error", message: "OTP expired." });
    return;
  }

  if (entry.otp !== otp) {
    res.status(400).json({ status: "error", message: "Invalid OTP." });
    return;
  }

  otpStore.delete(email);
  res.json({ status: "ok", message: "OTP verified successfully." });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", activeOtps: otpStore.size });
});

transporter.verify().then(() => {
  app.listen(PORT, () => {
    process.stdout.write(`OTP server listening on http://localhost:${PORT}\n`);
  });
}).catch((error) => {
  console.error("SMTP verification failed:", error?.message || error);
  process.exit(1);
});
