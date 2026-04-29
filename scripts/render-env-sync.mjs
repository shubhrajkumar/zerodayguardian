import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const cwd = process.cwd();
const envPath = path.resolve(cwd, process.argv[2] || ".env");

const REQUIRED_KEYS = [
  "MONGODB_URI",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "SESSION_SECRET",
  "JWT_SECRET",
  "APP_BASE_URL",
  "BACKEND_PUBLIC_URL",
  "CORS_ORIGIN",
  "GOOGLE_REDIRECT_URI",
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

const expectedGoogleRedirectUri = "https://zerodayguardian-backend.onrender.com/auth/google/callback";
const expectedFrontendOrigin = "https://zerodayguardian-delta.vercel.app";

const audit = {
  envPath,
  requiredKeys: REQUIRED_KEYS,
  missingKeys,
  urlMismatch: {
    GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI !== expectedGoogleRedirectUri
      ? {
          current: env.GOOGLE_REDIRECT_URI || "",
          expected: expectedGoogleRedirectUri,
        }
      : null,
    CORS_ORIGIN: String(env.CORS_ORIGIN || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .includes(expectedFrontendOrigin)
      ? null
      : {
          current: env.CORS_ORIGIN || "",
          expectedToInclude: expectedFrontendOrigin,
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

if (missingKeys.length) {
  process.exitCode = 2;
}
