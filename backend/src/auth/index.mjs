import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.mjs";
import {
  authenticateGoogleUser,
  clearAuthCookies,
  getUserById,
  loginUser,
  refreshAuth,
  registerUser,
  requestPasswordReset,
  resetPassword,
  revokeRefreshSession,
  setAuthCookies,
  updateUserThemePreference,
  verifyUserOtp,
} from "../services/authService.mjs";

export const authMiddleware = Object.freeze({
  optionalAuth,
  requireAuth,
  requireRole,
});

export const authService = Object.freeze({
  authenticateGoogleUser,
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  verifyUserOtp,
  refreshAuth,
  setAuthCookies,
  clearAuthCookies,
  revokeRefreshSession,
  getUserById,
  updateUserThemePreference,
});
