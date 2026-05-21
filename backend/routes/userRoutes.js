import { Router } from "express";
import { z } from "zod";
import { getProfile, updateProfile } from "../controllers/userController.js";
import { requireAuth } from "../src/middleware/auth.mjs";
import { validateBody } from "../src/middleware/validate.mjs";

const router = Router();

const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().max(200).optional(),
  })
  .refine((data) => Boolean(data.name || data.email), { message: "Provide at least one field to update." });

router.get("/profile", requireAuth, getProfile);
router.put("/update", requireAuth, validateBody(updateUserSchema), updateProfile);

export default router;
