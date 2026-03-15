import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.mjs";
import {
  clearAuthCookies,
  createPasswordResetRequest,
  getOrCreateOAuthUser,
  getUserById,
  loginUser,
  refreshAuth,
  registerUser,
  resetPasswordWithToken,
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
  loginUser,
  refreshAuth,
  setAuthCookies,
  clearAuthCookies,
  getOrCreateOAuthUser,
  getUserById,
  createPasswordResetRequest,
  resetPasswordWithToken,
  updateUserThemePreference,
});

