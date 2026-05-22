import fs from "node:fs";
import path from "node:path";
import { ObjectId } from "mongodb";
import { logWarn } from "../../src/utils/logger.mjs";

const storePath = process.env.AUTH_FALLBACK_STORE_FILE || "/tmp/zeroday-guardian-auth-fallback.json";
let state = { users: [] };
let loaded = false;

const load = () => {
  if (loaded) return;
  loaded = true;
  try {
    if (!fs.existsSync(storePath)) return;
    const payload = JSON.parse(fs.readFileSync(storePath, "utf8"));
    if (Array.isArray(payload?.users)) state.users = payload.users;
  } catch (error) {
    logWarn("Auth fallback store load failed", { error: String(error?.message || error) });
  }
};

const save = () => {
  try {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(state, null, 2));
  } catch (error) {
    logWarn("Auth fallback store save failed", { error: String(error?.message || error) });
  }
};

const valueEquals = (left, right) => String(left ?? "") === String(right ?? "");

const matchesQuery = (document, query = {}) => {
  if (Array.isArray(query.$or)) return query.$or.some((item) => matchesQuery(document, item));
  return Object.entries(query).every(([key, value]) => valueEquals(document?.[key], value));
};

const applyUpdate = (document, update = {}) => {
  if (update.$set && typeof update.$set === "object") {
    Object.assign(document, update.$set);
  }
  if (update.$unset && typeof update.$unset === "object") {
    for (const key of Object.keys(update.$unset)) delete document[key];
  }
};

export const getAuthFallbackCollection = (name) => {
  load();
  if (name !== "users") throw new Error(`Auth fallback collection ${name} is not supported`);
  return {
    __authFallbackStore: true,
    async findOne(query) {
      return state.users.find((item) => matchesQuery(item, query)) || null;
    },
    async insertOne(document) {
      const insertedId = document?._id || new ObjectId();
      const row = { ...document, _id: insertedId };
      state.users.push(row);
      save();
      return { acknowledged: true, insertedId };
    },
    async updateOne(query, update) {
      const row = state.users.find((item) => matchesQuery(item, query));
      if (!row) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
      applyUpdate(row, update);
      save();
      return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
    },
  };
};
