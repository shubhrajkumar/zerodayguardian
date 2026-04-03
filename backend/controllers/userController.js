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
