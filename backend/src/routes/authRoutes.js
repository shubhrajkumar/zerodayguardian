import { Router } from "express";
import { validateBody } from "../middleware/validate.mjs";
import { authProvidersRateLimit, authRateLimit, authSessionRateLimit } from "../middleware/rateLimit.mjs";
import { requireCsrf } from "../middleware/csrf.mjs";
import { forgotPasswordSchema, googleLoginSchema, loginSchema, refreshSchema, resetPasswordSchema, signupSchema, verifyOtpSchema } from "../validators/authSchemas.mjs";
import { forgotPassword, getAuthProviders, getAuthStatus, getCsrf, googleLogin, googleOauthCallback, login, logout, refreshSession, resetPasswordHandler, signup, startGoogleOauth, verifyAuth, verifyOtp } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.mjs";

const router = Router();

router.get("/csrf", authSessionRateLimit, getCsrf);
router.get("/status", authSessionRateLimit, getAuthStatus);
router.get("/session", authSessionRateLimit, getAuthStatus);
router.get("/verify", authSessionRateLimit, requireAuth, verifyAuth);
router.get("/me", authSessionRateLimit, requireAuth, verifyAuth);
router.get("/providers", authProvidersRateLimit, getAuthProviders);
router.get("/google", authProvidersRateLimit, startGoogleOauth);
router.get("/google/callback", authProvidersRateLimit, googleOauthCallback);
router.get("/oauth/google/start", authProvidersRateLimit, startGoogleOauth);
router.get("/oauth/google/callback", authProvidersRateLimit, googleOauthCallback);
router.post("/signup", authRateLimit, validateBody(signupSchema), signup);
router.post("/login", authRateLimit, validateBody(loginSchema), login);
router.post("/verify-otp", authRateLimit, validateBody(verifyOtpSchema), verifyOtp);
router.post("/forgot-password", authRateLimit, validateBody(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", authRateLimit, validateBody(resetPasswordSchema), resetPasswordHandler);
router.post("/google", authRateLimit, validateBody(googleLoginSchema), googleLogin);
router.post("/refresh", authSessionRateLimit, validateBody(refreshSchema), refreshSession);
router.post("/logout", authSessionRateLimit, requireCsrf, validateBody(refreshSchema), logout);

export default router;
