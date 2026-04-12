import { Router } from "express";
import { validateBody } from "../src/middleware/validate.mjs";
import { authProvidersRateLimit, authRateLimit, authSessionRateLimit } from "../src/middleware/rateLimit.mjs";
import { requireCsrf } from "../src/middleware/csrf.mjs";
import { googleLoginSchema, loginSchema, refreshSchema, resetPasswordSchema, sendOtpSchema, signupSchema } from "../src/validators/authSchemas.mjs";
import { getAuthProviders, getCsrf, googleLogin, googleOauthCallback, login, logout, refreshSession, resetUserPassword, sendOtp, signup, startGoogleOauth } from "../controllers/authController.js";

const router = Router();

router.get("/csrf", authSessionRateLimit, getCsrf);
router.get("/providers", authProvidersRateLimit, getAuthProviders);
router.get("/google", authProvidersRateLimit, startGoogleOauth);
router.get("/google/callback", authProvidersRateLimit, googleOauthCallback);
router.get("/oauth/google/start", authProvidersRateLimit, startGoogleOauth);
router.get("/oauth/google/callback", authProvidersRateLimit, googleOauthCallback);
router.post("/signup", authRateLimit, validateBody(signupSchema), signup);
router.post("/login", authRateLimit, validateBody(loginSchema), login);
router.post("/google", authRateLimit, validateBody(googleLoginSchema), googleLogin);
router.post("/send-otp", authRateLimit, validateBody(sendOtpSchema), sendOtp);
router.post("/reset-password", authRateLimit, validateBody(resetPasswordSchema), resetUserPassword);
router.post("/refresh", authSessionRateLimit, validateBody(refreshSchema), refreshSession);
router.post("/logout", authSessionRateLimit, requireCsrf, validateBody(refreshSchema), logout);

export default router;
