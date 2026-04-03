import nodemailer from "nodemailer";
import { env } from "../config/env.mjs";
import { logWarn } from "../utils/logger.mjs";

const shouldSendEmail = () =>
  env.osintAlertEmailEnabled &&
  env.osintSmtpHost &&
  env.osintSmtpPort &&
  env.osintSmtpFrom &&
  env.osintSmtpTo;

const SEVERITY_WEIGHT = {
  low: 1,
  medium: 2,
  high: 3,
};

const sendEmail = async ({ subject, text }) => {
  if (!shouldSendEmail()) return false;
  try {
    const transporter = nodemailer.createTransport({
      host: env.osintSmtpHost,
      port: Number(env.osintSmtpPort),
      secure: Number(env.osintSmtpPort) === 465,
      auth: env.osintSmtpUser ? { user: env.osintSmtpUser, pass: env.osintSmtpPass } : undefined,
    });
    await transporter.sendMail({
      from: env.osintSmtpFrom,
      to: env.osintSmtpTo,
      subject,
      text,
    });
    return true;
  } catch (error) {
    logWarn("OSINT alert email failed", { reason: String(error?.message || error) });
    return false;
  }
};

const sendWebhook = async ({ payload }) => {
  if (!env.osintAlertWebhookUrl) return false;
  try {
    const response = await fetch(env.osintAlertWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      logWarn("OSINT webhook rejected request", { statusCode: response.status });
      return false;
    }
    return true;
  } catch (error) {
    logWarn("OSINT webhook failed", { reason: String(error?.message || error) });
    return false;
  }
};

const sendSlack = async ({ title, text, severity }) => {
  if (!env.osintAlertSlackWebhookUrl) return false;
  try {
    const response = await fetch(env.osintAlertSlackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `OSINT Alert: ${title}`,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: `OSINT Alert (${severity})`, emoji: false },
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: `*${title}*\n${text}` },
          },
        ],
      }),
    });
    if (!response.ok) {
      logWarn("OSINT slack webhook rejected request", { statusCode: response.status });
      return false;
    }
    return true;
  } catch (error) {
    logWarn("OSINT slack webhook failed", { reason: String(error?.message || error) });
    return false;
  }
};

export const routeOsintAlert = async ({
  severity = "low",
  title,
  message,
  data = {},
  routing = {},
}) => {
  const minSeverity = routing.minSeverity || "medium";
  const current = SEVERITY_WEIGHT[severity] || SEVERITY_WEIGHT.low;
  const min = SEVERITY_WEIGHT[minSeverity] || SEVERITY_WEIGHT.medium;
  if (current < min) return;

  const mode = routing.mode || "all";
  const map = routing.severityMap || {};
  const levelMap = map[severity] || {};
  const allowEmail = mode === "severity" ? levelMap.email === true : routing.email !== false;
  const allowWebhook = mode === "severity" ? levelMap.webhook === true : routing.webhook !== false;
  const allowSlack = mode === "severity" ? levelMap.slack === true : routing.slack !== false;
  const text = `${message}\n\nData: ${JSON.stringify(data, null, 2)}`;
  const payload = {
    ts: new Date().toISOString(),
    severity,
    title: String(title || "OSINT Alert"),
    message: String(message || ""),
    data,
  };
  await Promise.allSettled([
    allowEmail ? sendEmail({ subject: payload.title, text }) : false,
    allowWebhook ? sendWebhook({ payload }) : false,
    allowSlack ? sendSlack({ title: payload.title, text: payload.message, severity }) : false,
  ]);
};
