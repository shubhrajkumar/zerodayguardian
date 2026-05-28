import { emailAvailableForUser, getUserById, updateUserProfileSecure } from "../src/services/authService.mjs";
import { logError, logInfo } from "../src/utils/logger.mjs";

const toPublicUser = (user) =>
  user
    ? {
        id: user._id?.toString?.() || "",
        name: String(user.name || ""),
        email: String(user.email || ""),
        role: String(user.role || "user"),
      }
    : null;

const toTokenBackedUser = (authUser) => ({
  id: String(authUser?.sub || ""),
  name: String(authUser?.name || authUser?.preferred_username || "Operator"),
  email: String(authUser?.email || ""),
  role: String(authUser?.role || "user"),
});

const isDbUnavailableError = (error) =>
  String(error?.code || "").toLowerCase() === "db_unavailable" ||
  String(error?.message || "").toLowerCase().includes("database not initialized");

export const getProfile = async (req, res, next) => {
  try {
    logInfo("User profile requested", { requestId: req.requestId || "", userId: req.user?.sub || "" });
    const user = await getUserById(req.user.sub);
    if (!user) {
      res.json({ status: "ok", user: toTokenBackedUser(req.user) });
      return;
    }
    res.json({ status: "ok", user: toPublicUser(user) });
  } catch (error) {
    if (isDbUnavailableError(error)) {
      logInfo("User profile served from token fallback", {
        requestId: req.requestId || "",
        userId: req.user?.sub || "",
      });
      res.json({ status: "ok", user: toTokenBackedUser(req.user) });
      return;
    }
    logError("User profile request failed", error, { requestId: req.requestId || "", userId: req.user?.sub || "" });
    res.status(500).json({
      status: "error",
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.message || "An unexpected error occurred.",
      requestId: req.requestId || "",
    });
  }
};

const upsertUser = async (uid, data) => {
  try {
    const { getDb } = await import("../src/config/db.mjs");
    const db = getDb();
    const timestamp = Date.now();
    const existing = await db.collection("users").findOne({
      $or: [{ _id: new (await import("mongodb")).ObjectId(uid) }, { uid }],
    });
    if (existing) {
      const updates = { updatedAt: timestamp };
      if (data.email) updates.email = data.email;
      if (data.displayName) updates.displayName = data.displayName;
      if (data.photoURL) updates.photoURL = data.photoURL;
      await db.collection("users").updateOne({ _id: existing._id }, { $set: updates });
      return { ...existing, ...updates, _id: existing._id };
    }
    const newUser = {
      uid,
      email: data.email || "",
      displayName: data.displayName || "",
      photoURL: data.photoURL || "",
      xp: 0,
      level: 1,
      role: "user",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const result = await db.collection("users").insertOne(newUser);
    return { ...newUser, _id: result.insertedId };
  } catch {
    return null;
  }
};

export const syncUser = async (req, res) => {
  try {
    const user = await upsertUser(req.validatedBody.uid, req.validatedBody);
    if (!user) {
      res.status(503).json({ success: false, code: "db_unavailable", message: "Database temporarily unavailable" });
      return;
    }
    res.json({
      success: true,
      user: {
        id: user._id?.toString?.() || user.uid,
        email: user.email,
        displayName: user.displayName,
        xp: user.xp || 0,
        level: user.level || 1,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, code: "sync_failed", message: error.message });
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    logInfo("User profile update requested", { requestId: req.requestId || "", userId: req.user?.sub || "" });
    const updates = {};
    if (req.validatedBody.name) updates.name = String(req.validatedBody.name).trim();
    if (req.validatedBody.email) updates.email = String(req.validatedBody.email).trim().toLowerCase();

    if (updates.email) {
      const available = await emailAvailableForUser({ email: updates.email, excludeUserId: req.user.sub });
      if (!available) {
        res.status(409).json({ status: "error", code: "email_in_use", error: "Email already in use" });
        return;
      }
    }

    const user = await updateUserProfileSecure({
      userId: req.user.sub,
      name: updates.name,
      email: updates.email,
    });
    if (!user) {
      res.status(404).json({ status: "error", code: "user_not_found", error: "User not found" });
      return;
    }
    res.json({ status: "ok", user: toPublicUser(user) });
  } catch (error) {
    if (isDbUnavailableError(error)) {
      res.status(503).json({
        status: "error",
        code: "profile_store_unavailable",
        message: "Profile storage is temporarily unavailable. Please retry once the database reconnects.",
        requestId: req.requestId || "",
      });
      return;
    }
    logError("User profile update failed", error, { requestId: req.requestId || "", userId: req.user?.sub || "" });
    res.status(500).json({
      status: "error",
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.message || "An unexpected error occurred.",
      requestId: req.requestId || "",
    });
  }
};
