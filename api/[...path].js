import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "../backend/src/app.mjs";
import { connectDb } from "../backend/src/config/db.mjs";

const app = createApp();
const MONGO_URI = String(process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGODB_URI || "")
  .trim()
  .replace(/^['"]|['"]$/g, "");
const MONGO_CONNECT_TIMEOUT_MS = Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 8000);

let initPromise = null;

const isAuthProvidersRequest = (req) => {
  const path = String(req?.url || req?.path || "");
  return /\/auth\/providers\/?$/.test(path);
};

const isAuthCsrfRequest = (req) => {
  const path = String(req?.url || req?.path || "");
  return /\/auth\/csrf\/?$/.test(path);
};

const ensureMongo = async () => {
  if (!MONGO_URI) return;
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
  ]).catch((error) => {
    console.warn("[Vercel API] Mongo connect skipped:", error instanceof Error ? error.message : String(error));
  });
};

const ensureInit = async () => {
  if (!initPromise) {
    initPromise = (async () => {
      await ensureMongo();
      await connectDb().catch((error) => {
        console.warn("[Vercel API] Native DB pool connect skipped:", error instanceof Error ? error.message : String(error));
      });
    })();
  }
  return initPromise;
};

export default async function handler(req, res) {
  try {
    await ensureInit();
    return app(req, res);
  } catch (error) {
    console.error("[Vercel API] Function bootstrap failed:", error instanceof Error ? error.message : String(error));

    if (isAuthProvidersRequest(req)) {
      return res.status(200).json({
        status: "ok",
        degraded: true,
        google: {
          enabled: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID || ""),
          clientId: String(process.env.GOOGLE_OAUTH_CLIENT_ID || ""),
          backendFlow: true,
          startUrl: "",
          callbackUrl: "",
          redirectUri: String(process.env.GOOGLE_REDIRECT_URI || ""),
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
        csrfToken: true,
      });
    }

    return res.status(503).json({
      status: "error",
      code: "serverless_bootstrap_failed",
      message: "The API is temporarily recovering. Please retry shortly.",
    });
  }
}
