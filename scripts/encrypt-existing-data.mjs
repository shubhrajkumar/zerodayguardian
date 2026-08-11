#!/usr/bin/env node
/**
 * Migration: Encrypt existing unencrypted user data with DB_ENCRYPTION_KEY.
 *
 * Usage:
 *   DB_ENCRYPTION_KEY=<64-char-hex> node scripts/encrypt-existing-data.mjs
 *
 * What it does:
 * 1. Connects to MongoDB using the same URI resolution as the server.
 * 2. Finds all users whose email/name/avatarUrl do NOT start with "enc:".
 * 3. Encrypts those fields in-place using the current DB_ENCRYPTION_KEY.
 * 4. Reports how many users were updated.
 *
 * Safe to run multiple times — already-encrypted fields are skipped.
 */

import "dotenv/config";
import { MongoClient } from "mongodb";
import crypto from "node:crypto";

const MONGO_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || process.env.MONGO_URI || "";
const DB_NAME = process.env.MONGODB_DB_NAME || "zeroday_guardian";
const DB_ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || "";

if (!DB_ENCRYPTION_KEY) {
  console.error("[Migration] DB_ENCRYPTION_KEY is not set. Aborting.");
  process.exit(1);
}
if (DB_ENCRYPTION_KEY.length < 32) {
  console.error("[Migration] DB_ENCRYPTION_KEY must be at least 32 characters. Aborting.");
  process.exit(1);
}
if (!MONGO_URI) {
  console.error("[Migration] MONGODB_URI is not set. Aborting.");
  process.exit(1);
}

// ── Encryption helpers (mirrored from security.mjs) ──
const dbKey = () => crypto.scryptSync(DB_ENCRYPTION_KEY, "zorvix-db-salt", 32);

const encodePacked = (payload) => Buffer.from(JSON.stringify(payload)).toString("base64url");

// NOTE: This duplicates the encryption logic from backend/src/utils/security.mjs.
// If the encryption scheme changes in security.mjs, update this script accordingly.
const encryptSensitive = (value) => {
  if (!DB_ENCRYPTION_KEY) return value;
  if (value == null || value === "") return value;
  try {
    const key = dbKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const input = typeof value === "string" ? value : JSON.stringify(value);
    const encrypted = Buffer.concat([cipher.update(input, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:${encodePacked({ iv: iv.toString("base64"), tag: tag.toString("base64"), data: encrypted.toString("base64") })}`;
  } catch {
    return value;
  }
};

const SENSITIVE_FIELDS = ["email", "name", "avatarUrl"];

async function main() {
  console.log("[Migration] Connecting to MongoDB...");
  const client = new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });

  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("[Migration] Connected to MongoDB.");

    const db = client.db(DB_NAME);
    const users = db.collection("users");

    const totalCount = await users.countDocuments();
    console.log(`[Migration] Found ${totalCount} users in the database.`);

    // Find users with at least one unencrypted sensitive field
    const unencryptedUsers = await users
      .find({
        $or: SENSITIVE_FIELDS.flatMap((field) => [
          { [field]: { $exists: true, $ne: null, $not: { $regex: /^enc:/ } } },
        ]),
      })
      .toArray();

    console.log(`[Migration] ${unencryptedUsers.length} users have unencrypted sensitive fields.`);

    if (unencryptedUsers.length === 0) {
      console.log("[Migration] Nothing to migrate. All user data is already encrypted or fields are empty.");
      return;
    }

    let updated = 0;
    for (const user of unencryptedUsers) {
      const updates = {};
      for (const field of SENSITIVE_FIELDS) {
        const value = user[field];
        if (value && typeof value === "string" && !value.startsWith("enc:")) {
          updates[field] = encryptSensitive(value);
        }
      }
      if (Object.keys(updates).length === 0) continue;

      await users.updateOne({ _id: user._id }, { $set: updates });
      updated++;
    }

    console.log(`[Migration] Successfully encrypted sensitive fields for ${updated} users.`);
    console.log("[Migration] Migration complete.");
  } catch (error) {
    console.error("[Migration] Error:", error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
