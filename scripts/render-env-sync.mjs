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
  "GOOGLE_AUTH_CLIENT_ID",
  "GOOGLE_AUTH_CLIENT_SECRET",
  "GOOGLE_WEB_CLIENT_ID",
  "GOOGLE_WEB_CLIENT_SECRET",
  "GOOGLE_ID",
  "GOOGLE_SECRET",
  "VITE_GOOGLE_CLIENT_ID",
  "VITE_GOOGLE_CLIENT_SECRET",
  "REACT_APP_GOOGLE_CLIENT_ID",
  "REACT_APP_GOOGLE_CLIENT_SECRET",
];

const OPTIONAL_AUTH_EMAIL_KEYS = [
  "AUTH_EMAIL_ENABLED",
  "AUTH_EMAIL_FROM",
  "AUTH_EMAIL_USER",
  "AUTH_EMAIL_APP_PASSWORD",
];

const OPTIONAL_ESCAPE_KEYS = new Set(["FIREBASE_PRIVATE_KEY"]);
const MONGO_URI_KEYS = ["MONGODB_URI", "DATABASE_URL", "MONGODB_URL", "MONGO_URI", "MONGO_URL", "DB_URI"];
const GOOGLE_ID_KEYS = ["GOOGLE_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_AUTH_CLIENT_ID", "GOOGLE_WEB_CLIENT_ID", "GOOGLE_ID", "VITE_GOOGLE_CLIENT_ID", "REACT_APP_GOOGLE_CLIENT_ID"];
const GOOGLE_SECRET_KEYS = ["GOOGLE_CLIENT_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_AUTH_CLIENT_SECRET", "GOOGLE_WEB_CLIENT_SECRET", "GOOGLE_SECRET", "VITE_GOOGLE_CLIENT_SECRET", "REACT_APP_GOOGLE_CLIENT_SECRET"];
const EMAIL_FROM_KEYS = ["AUTH_EMAIL_FROM", "EMAIL_FROM", "MAIL_FROM", "SMTP_FROM", "GMAIL_USER"];
const EMAIL_USER_KEYS = ["AUTH_EMAIL_USER", "EMAIL_USER", "MAIL_USER", "SMTP_USER", "GMAIL_USER"];
const EMAIL_PASS_KEYS = ["AUTH_EMAIL_APP_PASSWORD", "AUTH_EMAIL_PASSWORD", "EMAIL_PASSWORD", "MAIL_PASSWORD", "SMTP_PASS", "SMTP_PASSWORD", "GMAIL_PASS"];

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

const hasMongoUri = MONGO_URI_KEYS.some((key) => String(env[key] || "").trim());
const missingKeys = REQUIRED_KEYS.filter((key) => {
  if (key === "MONGODB_URI") return !hasMongoUri;
  return !String(env[key] || "").trim();
});
const firstEnv = (keys) => keys.some((key) => String(env[key] || "").trim());
const googleClientId = firstEnv(GOOGLE_ID_KEYS);
const googleClientSecret = firstEnv(GOOGLE_SECRET_KEYS);
const configuredGoogleOauthKeys = [...OPTIONAL_GOOGLE_OAUTH_KEYS, ...LEGACY_GOOGLE_OAUTH_KEYS].filter((key) => String(env[key] || "").trim());
const missingGoogleOauthKeys =
  configuredGoogleOauthKeys.length === 0
    ? []
    : [
        googleClientId ? "" : "GOOGLE_CLIENT_ID or GOOGLE_OAUTH_CLIENT_ID",
        googleClientSecret ? "" : "GOOGLE_CLIENT_SECRET or GOOGLE_OAUTH_CLIENT_SECRET",
      ].filter(Boolean);
const authEmailEnabled = String(env.AUTH_EMAIL_ENABLED || "").trim().toLowerCase() === "true" ||
  Boolean(firstEnv(EMAIL_FROM_KEYS) && firstEnv(EMAIL_USER_KEYS) && firstEnv(EMAIL_PASS_KEYS));
const missingAuthEmailKeys = authEmailEnabled
  ? [
      firstEnv(EMAIL_FROM_KEYS) ? "" : EMAIL_FROM_KEYS.join(" or "),
      firstEnv(EMAIL_USER_KEYS) ? "" : EMAIL_USER_KEYS.join(" or "),
      firstEnv(EMAIL_PASS_KEYS) ? "" : EMAIL_PASS_KEYS.join(" or "),
    ].filter(Boolean)
  : [];

const expectedGoogleRedirectUri = "https://zerodayguardian-backend.onrender.com/auth/google/callback";
const expectedFrontendOrigins = [
  "https://zerodayguardian.vercel.app",
  "https://zeroday-guardian.vercel.app",
];
const configuredCorsOrigins = String(env.CORS_ORIGIN || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const audit = {
  envPath,
  requiredKeys: [...REQUIRED_KEYS, ...OPTIONAL_GOOGLE_OAUTH_KEYS],
  mongoUriAliases: MONGO_URI_KEYS,
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
