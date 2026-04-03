import { ObjectId } from "mongodb";
import { getDb } from "../config/db.mjs";
import { sanitizeText } from "../utils/security.mjs";
import { TtlCache } from "../utils/ttlCache.mjs";

const COLLECTION = "user_notifications";
const notificationListCache = new TtlCache({ ttlMs: 10_000, maxEntries: 500 });

const normalizeUserId = (userId) => (ObjectId.isValid(userId) ? new ObjectId(userId) : userId);
const listCacheKey = (userId, limit) => `${String(userId)}:${Math.max(1, Math.min(50, Number(limit) || 20))}`;
const invalidateUserNotificationCache = (userId) => {
  const prefix = `${String(userId)}:`;
  for (const key of notificationListCache.store.keys()) {
    if (String(key).startsWith(prefix)) notificationListCache.delete(key);
  }
};

export const createNotification = async ({
  userId,
  title,
  message,
  severity = "info",
  type = "general",
  metadata = {},
} = {}) => {
  if (!userId) return null;
  const db = getDb();
  const now = Date.now();
  const payload = {
    userId: normalizeUserId(userId),
    title: sanitizeText(String(title || "Notification").slice(0, 120)),
    message: sanitizeText(String(message || "").slice(0, 400)),
    severity: String(severity || "info"),
    type: String(type || "general"),
    metadata,
    read: false,
    createdAt: now,
  };
  await db.collection(COLLECTION).insertOne(payload);
  invalidateUserNotificationCache(userId);
  return payload;
};

export const listNotifications = async ({ userId, limit = 20 } = {}) => {
  if (!userId) return [];
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  return notificationListCache.getOrCreate(listCacheKey(userId, safeLimit), async () =>
    db
      .collection(COLLECTION)
      .find(
        { userId: normalizeUserId(userId) },
        {
          projection: {
            title: 1,
            message: 1,
            severity: 1,
            type: 1,
            read: 1,
            createdAt: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .toArray()
  );
};

export const markNotificationRead = async ({ userId, id } = {}) => {
  if (!userId || !id) return null;
  const db = getDb();
  const idFilter = ObjectId.isValid(id) ? new ObjectId(id) : id;
  await db.collection(COLLECTION).updateOne({ _id: idFilter, userId: normalizeUserId(userId) }, { $set: { read: true } });
  invalidateUserNotificationCache(userId);
  return true;
};

export const markAllNotificationsRead = async ({ userId } = {}) => {
  if (!userId) return null;
  const db = getDb();
  await db.collection(COLLECTION).updateMany({ userId: normalizeUserId(userId), read: false }, { $set: { read: true } });
  invalidateUserNotificationCache(userId);
  return true;
};
