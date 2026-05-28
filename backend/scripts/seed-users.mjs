#!/usr/bin/env node

/**
 * seed-users.mjs
 *
 * Seeds default admin + test users into MongoDB so there is always at least
 * one account after a fresh deployment.
 *
 * Usage:
 *   node backend/scripts/seed-users.mjs                     # idempotent — skips existing users
 *   node backend/scripts/seed-users.mjs --force             # deletes + re-creates users
 *   node backend/scripts/seed-users.mjs --admin-only        # only the admin user
 *
 * Env vars (all optional):
 *   SEED_ADMIN_EMAIL       default: admin@zerodayguardian.com
 *   SEED_ADMIN_PASSWORD    default: Admin@123456
 *   SEED_ADMIN_NAME        default: Admin
 *   SEED_TEST_EMAIL        default: test@zerodayguardian.com
 *   SEED_TEST_PASSWORD     default: Test@123456
 *   SEED_TEST_NAME         default: Test User
 */

import { connectDb, closeDb, getDb } from "../src/config/db.mjs";
import { seedDefaults } from "../src/seed/seedDefaults.mjs";

// Try to load .env from backend/ first, then project root (same logic as env.mjs)
import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";
const __scriptDir = path.dirname(fileURLToPath(import.meta.url));
// Try backend/.env first, then project root (same order as env.mjs)
dotenv.config({ path: path.resolve(__scriptDir, "..", ".env") });           // backend/
dotenv.config({ path: path.resolve(__scriptDir, "..", "..", ".env") });   // project root

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main = async () => {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const adminOnly = args.includes("--admin-only");

  console.log(`[seed-users] Starting seed`, { force, adminOnly, nodeEnv: process.env.NODE_ENV || "development" });

  // 1. Connect to MongoDB  — fail hard if DB is unavailable
  try {
    await connectDb();
    console.log(`[seed-users] MongoDB connected`, { dbName: getDb().databaseName });
  } catch (err) {
    console.error("[seed-users] FATAL: Could not connect to MongoDB. Seed aborted.");
    console.error(`  ${err.message}`);
    process.exit(1);
  }

  // 2. Seed users using the reusable module
  const { created, skipped, errors } = await seedDefaults({ force, adminOnly });

  // 3. Report results
  let exitCode = 0;
  for (const err of errors) {
    console.error("[seed-users] ERROR:", err);
    exitCode = 1;
  }

  console.log(`[seed-users] Seed complete`, { created, skipped, force, adminOnly });

  // 4. Clean up
  await closeDb();
  process.exit(exitCode);
};

main().catch(async (err) => {
  console.error("[seed-users] Unhandled error:", err?.message || err);
  await closeDb().catch(() => {});
  process.exit(1);
});
