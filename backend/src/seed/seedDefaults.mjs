/**
 * seedDefaults.mjs
 *
 * Reusable module that seeds default admin + test users into MongoDB.
 * Used by:
 *   - backend/scripts/seed-users.mjs  (manual CLI)
 *   - backend/server/server.js         (auto-seed on startup)
 *
 * Env vars (all optional):
 *   SEED_ADMIN_EMAIL       default: admin@zerodayguardian.com
 *   SEED_ADMIN_PASSWORD    default: Admin@123456
 *   SEED_ADMIN_NAME        default: Admin
 *   SEED_TEST_EMAIL        default: test@zerodayguardian.com
 *   SEED_TEST_PASSWORD     default: Test@123456
 *   SEED_TEST_NAME         default: Test User
 */

import { getDb } from "../config/db.mjs";
import { registerUser, getUserByEmail } from "../../services/security-service/authService.mjs";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CFG = {
  admin: {
    email:    process.env.SEED_ADMIN_EMAIL    || "admin@zerodayguardian.com",
    password: process.env.SEED_ADMIN_PASSWORD || "Admin@123456",
    name:     process.env.SEED_ADMIN_NAME     || "Admin",
    role:     "admin",
  },
  test: {
    email:    process.env.SEED_TEST_EMAIL     || "test@zerodayguardian.com",
    password: process.env.SEED_TEST_PASSWORD  || "Test@123456",
    name:     process.env.SEED_TEST_NAME      || "Test User",
    role:     "user",
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
 * Create a single seed user.
 *
 * Uses `registerUser` from authService so the new user is 100 % compatible
 * with the login / OTP / reset flow (same bcrypt rounds, same encryption).
 *
 * After creation the user document is patched so that:
 *   - `role` is set to the desired role (admin / user)
 *   - `emailVerified` is set to `true` so OTP / password-reset works
 *     immediately without needing an email verification step.
 */
const seedOne = async ({ email, password, name, role }) => {
  let user;

  try {
    user = await registerUser({ email, password, name });
    log("registerUser succeeded", { email, role });
  } catch (err) {
    if (err.code === "user_exists") {
      log("Skipping — user already exists", { email });
      return { created: false, email, skipped: true };
    }
    throw err;
  }

  // Upgrade role if needed & mark email as verified
  const users = getDb().collection("users");
  const updates = {
    emailVerified: true,
    emailVerifiedAt: Date.now(),
  };
  if (role) updates.role = role;

  await users.updateOne({ _id: user._id }, { $set: updates });

  log("Seed user created successfully", { email, role, emailVerified: true });
  return { created: true, email, role };
};

/**
 * Delete an existing user so a fresh one can be created (--force).
 */
const removeExisting = async (email) => {
  try {
    const user = await getUserByEmail({ email });
    if (!user) return false;

    const users = getDb().collection("users");
    await users.deleteOne({ _id: user._id });
    log("Removed existing user for --force re-seed", { email });
    return true;
  } catch (err) {
    log("Could not look up user for removal — skipping", { email, error: err.message });
    return false;
  }
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

  const seedTasks = [];

  // Admin user
  seedTasks.push(
    force
      ? removeExisting(CFG.admin.email).then(() => seedOne(CFG.admin))
      : seedOne(CFG.admin)
  );

  // Test user (unless --admin-only)
  if (!adminOnly) {
    seedTasks.push(
      force
        ? removeExisting(CFG.test.email).then(() => seedOne(CFG.test))
        : seedOne(CFG.test)
    );
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
