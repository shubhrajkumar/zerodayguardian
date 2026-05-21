import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.mjs";
import {
  authenticateGoogleUser,
  clearAuthCookies,
  getUserById,
  loginUser,
  refreshAuth,
  revokeRefreshSession,
  registerUser,
  resetPassword,
  sendResetOtp,
  setAuthCookies,
  updateUserThemePreference,
} from "../services/authService.mjs";

export const authMiddleware = Object.freeze({
  optionalAuth,
  requireAuth,
  requireRole,
});

export const authService = Object.freeze({
  registerUser,
  authenticateGoogleUser,
  loginUser,
  refreshAuth,
  setAuthCookies,
  clearAuthCookies,
  revokeRefreshSession,
  getUserById,
  sendResetOtp,
  resetPassword,
  updateUserThemePreference,
});
