import "dotenv/config";
import mongoose from "mongoose";
const MONGO_URI = String(process.env.MONGODB_URI || "")
  .trim()
  .replace(/^['"]|['"]$/g, "");
const MONGO_CONNECT_TIMEOUT_MS = Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 8000);

let initPromise = null;
let appPromise = null;

const isAuthProvidersRequest = (req) => {
  const path = String(req?.url || req?.path || "");
  return /\/auth\/providers\/?$/.test(path);
};

const isAuthCsrfRequest = (req) => {
  const path = String(req?.url || req?.path || "");
  return /\/auth\/csrf\/?$/.test(path);
};

const isHealthRequest = (req) => {
  const path = String(req?.url || req?.path || "");
  return /\/api\/health\/?$/.test(path) || /^\/health\/?$/.test(path);
};

const ensureMongo = async () => {
  if (!MONGO_URI) {
    throw new Error("Missing required environment variable: MONGODB_URI");
  }
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return;

  await Promise.race([
    mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: MONGO_CONNECT_TIMEOUT_MS,
      connectTimeoutMS: MONGO_CONNECT_TIMEOUT_MS,
      family: 4,
      maxPoolSize: 10,
      autoIndex: true,
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Mongo connect timeout after ${MONGO_CONNECT_TIMEOUT_MS}ms`)), MONGO_CONNECT_TIMEOUT_MS)
    ),
  ]);
};

const ensureInit = async () => {
  if (!initPromise) {
    initPromise = (async () => {
      const [{ connectDb }] = await Promise.all([
        import("../backend/src/config/db.mjs"),
      ]);
      await ensureMongo();
      await connectDb();
    })();
  }
  return initPromise;
};

const getApp = async () => {
  if (!appPromise) {
    appPromise = import("../backend/src/app.mjs").then(({ createApp }) => createApp());
  }
  return appPromise;
};

export default async function handler(req, res) {
  try {
    await ensureInit();
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    console.error("[Vercel API] Function bootstrap failed:", error instanceof Error ? error.message : String(error));

    if (isAuthProvidersRequest(req)) {
      const googleClientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "").trim();
      const googleClientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
      const googleRedirectUri = String(process.env.GOOGLE_REDIRECT_URI || "").trim();
      const hasGoogleRedirectFlow = Boolean(googleClientId && googleClientSecret && googleRedirectUri);
      const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").trim();
      const proto = String(req.headers["x-forwarded-proto"] || "https").trim();
      const baseUrl = host ? `${proto}://${host}`.replace(/\/+$/, "") : "";
      return res.status(200).json({
        status: "ok",
        degraded: true,
        google: {
          enabled: Boolean(googleClientId),
          clientId: googleClientId,
          backendFlow: hasGoogleRedirectFlow,
          popupFlow: true,
          startUrl: hasGoogleRedirectFlow && baseUrl ? `${baseUrl}/api/auth/google` : "",
          callbackUrl: hasGoogleRedirectFlow && baseUrl ? `${baseUrl}/api/auth/google/callback` : "",
          redirectUri: hasGoogleRedirectFlow ? googleRedirectUri : "",
          frontendOrigin: String(process.env.APP_BASE_URL || ""),
          authorizedOrigins: String(process.env.GOOGLE_AUTHORIZED_ORIGINS || process.env.CORS_ORIGIN || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        },
      });
    }

    if (isAuthCsrfRequest(req)) {
      return res.status(200).json({
        status: "ok",
        degraded: true,
        csrfToken: "",
      });
    }

    if (isHealthRequest(req)) {
      return res.status(200).json({
        status: "ok",
        degraded: true,
        runtime: "vercel-serverless-fallback",
      });
    }

    return res.status(503).json({
      status: "error",
      code: "serverless_bootstrap_failed",
      message: "The API is temporarily recovering. Please retry shortly.",
    });
  }
}
