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
      const userId = req.user?.id || req.user?._id || req.user?.sub;

      const user = await User.findByIdAndUpdate(
        userId,
        {
          email: email || req.user.email,
          displayName: displayName || req.user.displayName,
          photoURL: photoURL || req.user.photoURL,
          lastSeen: new Date(),
          updatedAt: new Date()
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).select('-password -refreshToken');

      const responseUser = user ? {
        id: String(user._id || user.id),
        email: user.email,
        displayName: user.displayName,
        xp: user.xp || 0,
        level: user.level || 1,
      } : {
        id: uid || userId,
        email: email || "",
        displayName: displayName || "",
        xp: 0,
        level: 1,
      };

      return res.json({ success: true, user: responseUser });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "User sync failed"
      });
    }
  }
);

export default router;
