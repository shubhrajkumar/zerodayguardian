import { Router } from "express";
import { z } from "zod";
import { getProfile, syncUser, updateProfile } from "../controllers/userController.js";
import { requireAuth } from "../src/middleware/auth.mjs";
import { validateBody } from "../src/middleware/validate.mjs";
import { User } from "../src/models/User.mjs";

const router = Router();

const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().max(200).optional(),
  })
  .refine((data) => Boolean(data.name || data.email), { message: "Provide at least one field to update." });

const syncUserSchema = z.object({
  uid: z.string().trim().min(1),
  email: z.string().trim().email().optional(),
  displayName: z.string().trim().optional(),
  photoURL: z.string().trim().optional(),
});

router.get("/profile", requireAuth, getProfile);
router.put("/update", requireAuth, validateBody(updateUserSchema), updateProfile);

// POST /users — sync user endpoint
router.post("/",
  requireAuth,
  async (req, res) => {
    try {
      const { uid, email, displayName, photoURL } = req.body;
      const userId = req.user?.id || req.user?._id;

      const user = await User.findByIdAndUpdate(
        userId,
        {
          email: email || req.user.email,
          displayName: displayName || req.user.displayName,
          photoURL: photoURL || req.user.photoURL,
          lastSeen: new Date(),
          updatedAt: new Date()
        },
        { new: true, upsert: true }
      ).select('-password -refreshToken');

      return res.json({ success: true, user });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "User sync failed"
      });
    }
  }
);

export default router;
