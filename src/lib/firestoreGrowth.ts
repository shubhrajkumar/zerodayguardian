import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { z } from "zod";
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import { logger } from "@/lib/logger";

const referralSchema = z.object({
  userId: z.string().min(1),
  code: z.string().min(6),
  invites: z.number().int().nonnegative(),
  successfulReferrals: z.number().int().nonnegative(),
  monthlyPoints: z.number().int().nonnegative(),
  totalPointsAwarded: z.number().int().nonnegative(),
  referredUsers: z.array(z.string()).default([]),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});

const notificationDocSchema = z.object({
  unreadCount: z.number().int().nonnegative().default(0),
  weeklyDigestEmail: z.string().email().optional().nullable(),
  weeklyDigestEnabled: z.boolean().default(true),
  pushEnabled: z.boolean().default(true),
  updatedAt: z.any().optional(),
});

const notificationItemSchema = z.object({
  id: z.string(),
  type: z.enum(["streak", "mission", "referral", "achievement"]),
  title: z.string().min(1),
  message: z.string().min(1),
  read: z.boolean().default(false),
  actionUrl: z.string().default("/dashboard"),
  createdAt: z.any().optional(),
});

const publicProfileSchema = z.object({
  userId: z.string().min(1),
  handle: z.string().min(3),
  name: z.string().min(1),
  headline: z.string().default("Cyber operator in progress"),
  xp: z.number().int().nonnegative().default(0),
  level: z.number().int().positive().default(1),
  streak: z.number().int().nonnegative().default(0),
  badges: z.array(z.string()).default([]),
  completedLabs: z.number().int().nonnegative().default(0),
  monthlyReferralPoints: z.number().int().nonnegative().default(0),
  visibility: z.enum(["public", "private"]).default("public"),
  updatedAt: z.any().optional(),
});

export type ReferralRecord = z.infer<typeof referralSchema>;
export type NotificationPreference = z.infer<typeof notificationDocSchema>;
export type NotificationItem = z.infer<typeof notificationItemSchema>;
export type PublicProfile = z.infer<typeof publicProfileSchema>;

const defaultNotificationPreferences = (): NotificationPreference => ({
  unreadCount: 0,
  weeklyDigestEmail: null,
  weeklyDigestEnabled: true,
  pushEnabled: false,
});

let firestoreGrowthBlocked = false;

const isFirebaseRecoverableError = (error: unknown) => {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code || "") : "";
  const message =
    typeof error === "object" && error !== null && "message" in error ? String((error as { message?: string }).message || "") : String(error || "");
  const normalized = `${code} ${message}`.toLowerCase();
  return [
    "firebase is not configured",
    "firebase auth user is not ready",
    "temporarily disabled",
    "invalid-api-key",
    "permission-denied",
    "failed-precondition",
    "service firestore is not available",
    "client is offline",
    "network-request-failed",
    "the service is currently unavailable",
    "400",
    "424",
  ].some((token) => normalized.includes(token));
};

const logGrowthFallback = (message: string, error: unknown) => {
  if (!isFirebaseRecoverableError(error)) {
    logger.warn(message, "firestoreGrowth", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
};

const requireDb = () => {
  if (firestoreGrowthBlocked) {
    throw new Error("Firestore-backed growth features are temporarily disabled for this session.");
  }
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error("Firebase is not configured. Firestore-backed growth features are unavailable.");
  }
  if (!firebaseAuth?.currentUser?.uid) {
    throw new Error("Firebase Auth user is not ready. Firestore-backed growth features are unavailable.");
  }
  return firestoreDb;
};

const markFirestoreGrowthBlocked = (error: unknown) => {
  if (isFirebaseRecoverableError(error)) {
    firestoreGrowthBlocked = true;
  }
};

const slugifyHandle = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || `guardian-${Math.random().toString(36).slice(2, 8)}`;

const referralCodeFor = (userId: string) => `ZDG-${userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}`;

const toMillis = (value: unknown) => {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(String(value || "")).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
};

export const ensureReferralRecord = async (userId: string): Promise<ReferralRecord> => {
  try {
    const db = requireDb();
    const ref = doc(db, "referrals", userId);
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) {
      return referralSchema.parse({ userId, ...snapshot.data() });
    }
    const payload: Omit<ReferralRecord, "userId"> = {
      code: referralCodeFor(userId),
      invites: 0,
      successfulReferrals: 0,
      monthlyPoints: 0,
      totalPointsAwarded: 0,
      referredUsers: [],
    };
    await setDoc(ref, { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return referralSchema.parse({ userId, ...payload });
  } catch (error) {
    markFirestoreGrowthBlocked(error);
    logGrowthFallback("Referral record unavailable, using local fallback", error);
    return referralSchema.parse({
      userId,
      code: referralCodeFor(userId),
      invites: 0,
      successfulReferrals: 0,
      monthlyPoints: 0,
      totalPointsAwarded: 0,
      referredUsers: [],
    });
  }
};

export const applyReferralSignup = async (referrerUserId: string, referredUserId: string) => {
  try {
    const db = requireDb();
    const referrerRef = doc(db, "referrals", referrerUserId);
    const referredRef = doc(db, "referrals", referredUserId);
    const referrerProfileRef = doc(db, "public_profiles", referrerUserId);
    const referredProfileRef = doc(db, "public_profiles", referredUserId);

    await runTransaction(db, async (transaction) => {
      const [referrerSnap, referredSnap] = await Promise.all([
        transaction.get(referrerRef),
        transaction.get(referredRef),
      ]);

    const referrer = referralSchema.parse(
      referrerSnap.exists()
        ? { userId: referrerUserId, ...referrerSnap.data() }
        : {
            userId: referrerUserId,
            code: referralCodeFor(referrerUserId),
            invites: 0,
            successfulReferrals: 0,
            monthlyPoints: 0,
            totalPointsAwarded: 0,
            referredUsers: [],
          }
    );
    const referred = referralSchema.parse(
      referredSnap.exists()
        ? { userId: referredUserId, ...referredSnap.data() }
        : {
            userId: referredUserId,
            code: referralCodeFor(referredUserId),
            invites: 0,
            successfulReferrals: 0,
            monthlyPoints: 0,
            totalPointsAwarded: 0,
            referredUsers: [],
          }
    );

    if (referrer.referredUsers.includes(referredUserId)) return;

    transaction.set(
      referrerRef,
      {
        code: referrer.code,
        invites: referrer.invites,
        successfulReferrals: referrer.successfulReferrals + 1,
        monthlyPoints: referrer.monthlyPoints + 500,
        totalPointsAwarded: referrer.totalPointsAwarded + 500,
        referredUsers: [...referrer.referredUsers, referredUserId],
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    transaction.set(
      referrerProfileRef,
      {
        monthlyReferralPoints: referrer.monthlyPoints + 500,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(
      referredRef,
      {
        code: referred.code,
        invites: referred.invites,
        successfulReferrals: referred.successfulReferrals,
        monthlyPoints: referred.monthlyPoints + 200,
        totalPointsAwarded: referred.totalPointsAwarded + 200,
        referredUsers: referred.referredUsers,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
      transaction.set(
        referredProfileRef,
        {
          monthlyReferralPoints: referred.monthlyPoints + 200,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });
  } catch (error) {
    markFirestoreGrowthBlocked(error);
    logGrowthFallback("Referral signup application unavailable, skipping Firestore write", error);
  }
};

export const incrementReferralInvite = async (userId: string) => {
  try {
    const db = requireDb();
    const ref = doc(db, "referrals", userId);
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = referralSchema.parse(
        snapshot.exists()
          ? { userId, ...snapshot.data() }
          : {
              userId,
              code: referralCodeFor(userId),
              invites: 0,
              successfulReferrals: 0,
              monthlyPoints: 0,
              totalPointsAwarded: 0,
              referredUsers: [],
            }
      );
      transaction.set(
        ref,
        {
          code: current.code,
          invites: current.invites + 1,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });
  } catch (error) {
    markFirestoreGrowthBlocked(error);
    logGrowthFallback("Referral invite increment unavailable, skipping Firestore write", error);
  }
};

export const findReferrerByCode = async (code: string) => {
  try {
    const db = requireDb();
    const q = query(collection(db, "referrals"), where("code", "==", code.trim().toUpperCase()), limit(1));
    const rows = await getDocs(q);
    return rows.docs[0]?.id || null;
  } catch (error) {
    markFirestoreGrowthBlocked(error);
    logGrowthFallback("Referrer lookup unavailable, returning null", error);
    return null;
  }
};

export const getMonthlyReferralLeaderboard = async () => {
  try {
    const db = requireDb();
    const q = query(collection(db, "public_profiles"), where("visibility", "==", "public"), orderBy("monthlyReferralPoints", "desc"), limit(10));
    const rows = await getDocs(q);
    return rows.docs.map((item, index) => ({
      position: index + 1,
      ...publicProfileSchema.parse({ userId: item.id, ...item.data() }),
    }));
  } catch (error) {
    markFirestoreGrowthBlocked(error);
    logGrowthFallback("Referral leaderboard unavailable, returning empty list", error);
    return [];
  }
};

export const ensureNotificationPreferences = async (userId: string, email?: string | null) => {
  try {
    const db = requireDb();
    const ref = doc(db, "notifications", userId);
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) {
      return notificationDocSchema.parse(snapshot.data());
    }
    const payload = {
      unreadCount: 0,
      weeklyDigestEmail: email || null,
      weeklyDigestEnabled: true,
      pushEnabled: true,
    };
    await setDoc(ref, { ...payload, updatedAt: serverTimestamp() });
    return notificationDocSchema.parse(payload);
  } catch (error) {
    markFirestoreGrowthBlocked(error);
    logGrowthFallback("Notification preferences unavailable, using defaults", error);
    return notificationDocSchema.parse({
      ...defaultNotificationPreferences(),
      weeklyDigestEmail: email || null,
    });
  }
};

export const listNotifications = async (userId: string): Promise<NotificationItem[]> => {
  try {
    const db = requireDb();
    await ensureNotificationPreferences(userId);
    const q = query(collection(db, "notifications", userId, "items"), orderBy("createdAt", "desc"), limit(50));
    const rows = await getDocs(q);
    return rows.docs.map((item) => notificationItemSchema.parse({ id: item.id, ...item.data() }));
  } catch (error) {
    markFirestoreGrowthBlocked(error);
    logGrowthFallback("Notifications unavailable, returning empty list", error);
    return [];
  }
};

export const pushNotification = async (
  userId: string,
  payload: Omit<NotificationItem, "id" | "createdAt" | "read"> & { read?: boolean }
) => {
  try {
    const db = requireDb();
    const prefRef = doc(db, "notifications", userId);
    await ensureNotificationPreferences(userId);
    const itemRef = collection(db, "notifications", userId, "items");
    await addDoc(itemRef, {
      ...payload,
      read: Boolean(payload.read),
      createdAt: serverTimestamp(),
    });
    await runTransaction(db, async (transaction) => {
      const prefSnap = await transaction.get(prefRef);
      const current = notificationDocSchema.parse(prefSnap.exists() ? prefSnap.data() : {});
      transaction.set(
        prefRef,
        {
          ...current,
          unreadCount: current.unreadCount + (payload.read ? 0 : 1),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });
    return true;
  } catch (error) {
    markFirestoreGrowthBlocked(error);
    logGrowthFallback("Push notification unavailable, skipping Firestore write", error);
    return false;
  }
};

export const markNotificationRead = async (userId: string, notificationId: string) => {
  try {
    const db = requireDb();
    const prefRef = doc(db, "notifications", userId);
    const itemRef = doc(db, "notifications", userId, "items", notificationId);
    await runTransaction(db, async (transaction) => {
      const [prefSnap, itemSnap] = await Promise.all([transaction.get(prefRef), transaction.get(itemRef)]);
      if (!itemSnap.exists()) return;
      const item = notificationItemSchema.parse({ id: itemSnap.id, ...itemSnap.data() });
      if (item.read) return;
      const prefs = notificationDocSchema.parse(prefSnap.exists() ? prefSnap.data() : {});
      transaction.update(itemRef, { read: true });
      transaction.set(
        prefRef,
        {
          ...prefs,
          unreadCount: Math.max(0, prefs.unreadCount - 1),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });
  } catch (error) {
    markFirestoreGrowthBlocked(error);
    logGrowthFallback("Mark-notification-read unavailable, skipping Firestore write", error);
  }
};

export const syncPublicProfile = async (payload: {
  userId: string;
  name: string;
  email: string;
  xp: number;
  streak: number;
  level: number;
  badges: string[];
  completedLabs: number;
  monthlyReferralPoints?: number;
}) => {
  try {
    const db = requireDb();
    const handle = slugifyHandle(payload.name || payload.email.split("@")[0] || payload.userId);
    const profile: Omit<PublicProfile, "userId"> = {
      handle,
      name: payload.name,
      headline: payload.streak >= 7 ? "High-momentum cybersecurity operator" : "Cyber operator building verified momentum",
      xp: Math.max(0, Math.round(payload.xp)),
      level: Math.max(1, Math.round(payload.level || Math.floor(payload.xp / 1000) + 1)),
      streak: Math.max(0, payload.streak),
      badges: payload.badges.slice(0, 16),
      completedLabs: Math.max(0, payload.completedLabs),
      monthlyReferralPoints: Math.max(0, payload.monthlyReferralPoints || 0),
      visibility: "public",
    };
    await setDoc(doc(db, "public_profiles", payload.userId), { ...profile, updatedAt: serverTimestamp() }, { merge: true });
    return publicProfileSchema.parse({ userId: payload.userId, ...profile });
  } catch (error) {
    markFirestoreGrowthBlocked(error);
    logGrowthFallback("Public profile sync unavailable, using local profile fallback", error);
    return publicProfileSchema.parse({
      userId: payload.userId,
      handle: slugifyHandle(payload.name || payload.email.split("@")[0] || payload.userId),
      name: payload.name,
      headline: payload.streak >= 7 ? "High-momentum cybersecurity operator" : "Cyber operator building verified momentum",
      xp: Math.max(0, Math.round(payload.xp)),
      level: Math.max(1, Math.round(payload.level || Math.floor(payload.xp / 1000) + 1)),
      streak: Math.max(0, payload.streak),
      badges: payload.badges.slice(0, 16),
      completedLabs: Math.max(0, payload.completedLabs),
      monthlyReferralPoints: Math.max(0, payload.monthlyReferralPoints || 0),
      visibility: "public",
    });
  }
};

export const getPublicProfile = async (userIdOrHandle: string): Promise<PublicProfile | null> => {
  try {
    const db = requireDb();
    const directRef = doc(db, "public_profiles", userIdOrHandle);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) {
      return publicProfileSchema.parse({ userId: directSnap.id, ...directSnap.data() });
    }
    const q = query(collection(db, "public_profiles"), where("handle", "==", slugifyHandle(userIdOrHandle)), limit(1));
    const rows = await getDocs(q);
    if (!rows.docs.length) return null;
    return publicProfileSchema.parse({ userId: rows.docs[0].id, ...rows.docs[0].data() });
  } catch (error) {
    markFirestoreGrowthBlocked(error);
    logGrowthFallback("Public profile lookup unavailable, returning null", error);
    return null;
  }
};

export const logFrontendErrorToFirestore = async (payload: {
  userId?: string | null;
  source: string;
  message: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}) => {
  if (!isFirebaseConfigured || !firestoreDb) return;
  try {
    await addDoc(collection(firestoreDb, "frontend_errors"), {
      userId: payload.userId || null,
      source: payload.source,
      message: payload.message,
      stack: payload.stack || "",
      metadata: payload.metadata || {},
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    markFirestoreGrowthBlocked(error);
    logger.warn("Failed to persist frontend error to Firestore", "firestoreGrowth", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
};

export const buildShareLinks = (shareUrl: string, text: string) => {
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(text);
  return {
    whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
  };
};

export const sortNotificationsForVirtualList = (items: NotificationItem[]) =>
  [...items].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
