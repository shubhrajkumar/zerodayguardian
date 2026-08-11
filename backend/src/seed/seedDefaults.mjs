/**
 * seedDefaults.mjs
 *
 * Seeds default admin + test users into MongoDB.
 * With Google-only auth, seed users are created with a googleId so they can
 * authenticate via Google OAuth.
 */

import { getDb } from "../config/db.mjs";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CFG = {
  admin: {
    email:    process.env.SEED_ADMIN_EMAIL    || "admin@zerodayguardian.com",
    name:     process.env.SEED_ADMIN_NAME     || "Admin",
    role:     "admin",
    googleId: process.env.SEED_ADMIN_GOOGLE_ID || "seed-admin-google-id",
  },
  test: {
    email:    process.env.SEED_TEST_EMAIL     || "test@zerodayguardian.com",
    name:     process.env.SEED_TEST_NAME      || "Test User",
    role:     "user",
    googleId: process.env.SEED_TEST_GOOGLE_ID  || "seed-test-google-id",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const log = (msg, data) => {
  const line = data ? `${msg} ${JSON.stringify(data)}` : msg;
  console.log(`[seed-defaults] ${line}`);
};

/**
 * Create a single seed user directly in MongoDB.
 * Users authenticate via Google OAuth, so we set googleId and authProvider.
 */
const seedOne = async ({ email, name, role, googleId }) => {
  const users = getDb().collection("users");

  const existing = await users.findOne({ email });
  if (existing) {
    log("Skipping — user already exists", { email });
    return { created: false, email, skipped: true };
  }

  const timestamp = Date.now();
  const document = {
    email,
    name,
    role: role || "user",
    authProvider: "google",
    googleId,
    avatarUrl: "",
    emailVerified: true,
    emailVerifiedAt: timestamp,
    lastLoginAt: timestamp,
    settings: { theme: "dark", favoriteTools: [] },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await users.insertOne(document);
  log("Seed user created successfully", { email, role, emailVerified: true });
  return { created: true, email, role };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * seedDefaults({ force, adminOnly })
 *
 * Seeds the default admin (and optionally test) users into MongoDB.
 * Safe to call multiple times — skips existing users unless `force` is true.
 *
 * @param {object}   options
 * @param {boolean}  [options.force=false]     Delete + re-create existing users
 * @param {boolean}  [options.adminOnly=false]  Only seed the admin user
 * @returns {Promise<{created: number, skipped: number, results: Array}>}
 */
export const seedDefaults = async ({ force = false, adminOnly = false } = {}) => {
  log("Starting seed", { force, adminOnly, nodeEnv: process.env.NODE_ENV || "development" });

  const users = getDb().collection("users");

  const seedTasks = [];

  const seedWithForce = async (cfg) => {
    if (force) {
      const existing = await users.findOne({ email: cfg.email });
      if (existing) {
        await users.deleteOne({ _id: existing._id });
        log("Removed existing user for --force re-seed", { email: cfg.email });
      }
    }
    return seedOne(cfg);
  };

  seedTasks.push(seedWithForce(CFG.admin));

  if (!adminOnly) {
    seedTasks.push(seedWithForce(CFG.test));
  }

  const results = await Promise.allSettled(seedTasks);

  let exitCode = 0;
  const errors = [];
  for (const result of results) {
    if (result.status === "rejected") {
      errors.push(result.reason?.message || result.reason);
      exitCode = 1;
    }
  }

  const created = results.filter(
    (r) => r.status === "fulfilled" && r.value?.created
  ).length;
  const skipped = results.filter(
    (r) => r.status === "fulfilled" && r.value?.skipped
  ).length;

  log("Seed complete", { created, skipped, force, adminOnly });

  return { created, skipped, errors, exitCode, results };
};
