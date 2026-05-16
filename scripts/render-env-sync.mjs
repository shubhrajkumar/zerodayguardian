import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const cwd = process.cwd();
const envPath = path.resolve(cwd, process.argv[2] || ".env");

const REQUIRED_KEYS = [
  "MONGODB_URI",
  "SESSION_SECRET",
  "JWT_SECRET",
  "APP_BASE_URL",
  "BACKEND_PUBLIC_URL",
  "CORS_ORIGIN",
];

const OPTIONAL_GOOGLE_OAUTH_KEYS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
];

const LEGACY_GOOGLE_OAUTH_KEYS = [
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "VITE_GOOGLE_CLIENT_ID",
];

const OPTIONAL_AUTH_EMAIL_KEYS = [
  "AUTH_EMAIL_ENABLED",
  "AUTH_EMAIL_FROM",
  "AUTH_EMAIL_USER",
  "AUTH_EMAIL_APP_PASSWORD",
];

const OPTIONAL_ESCAPE_KEYS = new Set(["FIREBASE_PRIVATE_KEY"]);

const normalizeMultilineValueForRender = (value = "") =>
  String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, "\\n");

if (!fs.existsSync(envPath)) {
  console.error(`.env file not found at ${envPath}`);
  process.exit(1);
}

const parsed = dotenv.parse(fs.readFileSync(envPath, "utf8"));
const env = { ...parsed };

for (const key of OPTIONAL_ESCAPE_KEYS) {
  if (env[key]) env[key] = normalizeMultilineValueForRender(env[key]);
}

const missingKeys = REQUIRED_KEYS.filter((key) => !String(env[key] || "").trim());
const googleClientId = String(env.GOOGLE_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID || "").trim();
const googleClientSecret = String(env.GOOGLE_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
const configuredGoogleOauthKeys = [...OPTIONAL_GOOGLE_OAUTH_KEYS, ...LEGACY_GOOGLE_OAUTH_KEYS].filter((key) => String(env[key] || "").trim());
const missingGoogleOauthKeys =
  configuredGoogleOauthKeys.length === 0
    ? []
    : [
        googleClientId ? "" : "GOOGLE_CLIENT_ID or GOOGLE_OAUTH_CLIENT_ID",
        googleClientSecret ? "" : "GOOGLE_CLIENT_SECRET or GOOGLE_OAUTH_CLIENT_SECRET",
      ].filter(Boolean);
const authEmailEnabled = String(env.AUTH_EMAIL_ENABLED || "").trim().toLowerCase() === "true" ||
  Boolean((env.AUTH_EMAIL_FROM || env.GMAIL_USER) && (env.AUTH_EMAIL_USER || env.GMAIL_USER) && (env.AUTH_EMAIL_APP_PASSWORD || env.GMAIL_PASS));
const missingAuthEmailKeys = authEmailEnabled
  ? [
      (env.AUTH_EMAIL_FROM || env.GMAIL_USER) ? "" : "AUTH_EMAIL_FROM or GMAIL_USER",
      (env.AUTH_EMAIL_USER || env.GMAIL_USER) ? "" : "AUTH_EMAIL_USER or GMAIL_USER",
      (env.AUTH_EMAIL_APP_PASSWORD || env.GMAIL_PASS) ? "" : "AUTH_EMAIL_APP_PASSWORD or GMAIL_PASS",
    ].filter(Boolean)
  : [];

const expectedGoogleRedirectUri = "https://zerodayguardian-backend.onrender.com/auth/google/callback";
const expectedFrontendOrigins = [
  "https://zerodayguardian-delta.vercel.app",
  "https://zeroday-guardian.vercel.app",
];
const configuredCorsOrigins = String(env.CORS_ORIGIN || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const audit = {
  envPath,
  requiredKeys: [...REQUIRED_KEYS, ...OPTIONAL_GOOGLE_OAUTH_KEYS],
  legacyGoogleOauthKeys: LEGACY_GOOGLE_OAUTH_KEYS,
  passwordResetEmailKeys: OPTIONAL_AUTH_EMAIL_KEYS,
  missingKeys,
  googleOauthMissingKeys: missingGoogleOauthKeys,
  passwordResetEmailMissingKeys: missingAuthEmailKeys,
  passwordResetEmailNote: authEmailEnabled
    ? ""
    : "Password reset OTP email delivery is disabled until AUTH_EMAIL_ENABLED=true or Gmail/Auth email credentials are configured.",
  urlMismatch: {
    GOOGLE_REDIRECT_URI: String(env.GOOGLE_REDIRECT_URI || "").trim() && env.GOOGLE_REDIRECT_URI !== expectedGoogleRedirectUri
      ? {
          current: env.GOOGLE_REDIRECT_URI || "",
          expected: expectedGoogleRedirectUri,
        }
      : null,
    CORS_ORIGIN: expectedFrontendOrigins.every((origin) => configuredCorsOrigins.includes(origin))
      ? null
      : {
          current: env.CORS_ORIGIN || "",
          expectedToInclude: expectedFrontendOrigins,
        },
  },
};

const renderApiEnvVars = Object.entries(env)
  .filter(([, value]) => String(value || "").trim())
  .map(([key, value]) => ({
    key,
    value,
    sync: false,
  }));

const copyPasteList = Object.entries(env)
  .filter(([, value]) => String(value || "").trim())
  .map(([key, value]) => `${key}=${value}`)
  .join("\n");

const renderApiPayload = {
  serviceDetails: {
    envVars: renderApiEnvVars,
  },
};

console.log(JSON.stringify({
  audit,
  renderApiPayload,
  copyPasteList,
}, null, 2));

if (missingKeys.length || missingGoogleOauthKeys.length || missingAuthEmailKeys.length) {
  process.exitCode = 2;
}
