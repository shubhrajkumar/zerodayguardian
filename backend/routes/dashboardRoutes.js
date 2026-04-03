import { Router } from "express";
import { z } from "zod";
import { getAdaptiveDashboard, getDashboardStats, getPlatformCockpitDashboard, postAdaptiveEvent } from "../controllers/dashboardController.js";
import { requireAuth } from "../src/middleware/auth.mjs";
import { mutationRateLimit } from "../src/middleware/rateLimit.mjs";
import { validateBody } from "../src/middleware/validate.mjs";

const router = Router();
const adaptiveEventSchema = z.object({
  type: z.string().trim().min(2).max(64),
  surface: z.string().trim().min(2).max(64),
  target: z.string().trim().max(160).optional().default(""),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().default({}),
});

router.get("/stats", requireAuth, getDashboardStats);
router.get("/adaptive", requireAuth, getAdaptiveDashboard);
router.get("/platform-cockpit", requireAuth, getPlatformCockpitDashboard);
router.post("/adaptive/events", requireAuth, mutationRateLimit, validateBody(adaptiveEventSchema), postAdaptiveEvent);

export default router;
