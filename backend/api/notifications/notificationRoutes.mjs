import { Router } from "express";
import { validateQuery } from "../../src/middleware/validate.mjs";
import { validateBody } from "../../src/middleware/validate.mjs";
import { listQuerySchema } from "../../src/validators/notificationSchemas.mjs";
import { createNotification, listNotifications, markAllNotificationsRead, markNotificationRead } from "../../src/services/notificationService.mjs";
import { z } from "zod";

const router = Router();
const growthNotificationSchema = z.object({
  title: z.string().trim().min(3).max(120),
  message: z.string().trim().min(3).max(400),
  type: z.enum(["growth", "share", "referral", "badge"]).optional().default("growth"),
  severity: z.enum(["info", "success", "warning"]).optional().default("info"),
});

router.get("/", validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const items = await listNotifications({ userId: req.user?.sub, limit: req.validatedQuery.limit });
    res.json({ status: "ok", items });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/read", async (req, res, next) => {
  try {
    await markNotificationRead({ userId: req.user?.sub, id: req.params.id });
    res.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

router.post("/read-all", async (req, res, next) => {
  try {
    await markAllNotificationsRead({ userId: req.user?.sub });
    res.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

router.post("/seed", async (req, res, next) => {
  try {
    await createNotification({
      userId: req.user?.sub,
      title: "Welcome to ZeroDay Guardian",
      message: "Your workspace is ready. Start with a web scan or OSINT case.",
      severity: "info",
      type: "onboarding",
    });
    res.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

router.post("/growth", validateBody(growthNotificationSchema), async (req, res, next) => {
  try {
    await createNotification({
      userId: req.user?.sub,
      title: req.validatedBody.title,
      message: req.validatedBody.message,
      type: req.validatedBody.type,
      severity: req.validatedBody.severity,
    });
    res.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

export default router;
