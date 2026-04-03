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
  await ensureInit();
  return app(req, res);
}
