import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth } from "../../src/middleware/auth.mjs";
import { validateBody } from "../../src/middleware/validate.mjs";
import { User } from "../../src/models/User.mjs";

const router = Router();

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  settings: z
    .object({
      theme: z.enum(["dark"]).optional(),
      favoriteTools: z.array(z.string().max(80)).max(20).optional(),
    })
    .optional(),
});

const toUserPayload = (user) => {
  const mission = user.productProgress?.mission || {};
  return {
    status: "ok",
    user: {
      id: String(user._id || ""),
      name: String(user.name || ""),
      email: String(user.email || ""),
      role: String(user.role || "user"),
      brand: "ZeroDay Guardian",
      assistant: "ZORVIX AI",
      settings: {
        theme: "dark",
        favoriteTools: Array.isArray(user.settings?.favoriteTools) ? user.settings.favoriteTools : [],
      },
      progress: {
        totalScore: Number(mission.totalScore || 0),
        rank: String(mission.rank || "Initiate"),
        completedMissionIds: Array.isArray(mission.completedMissionIds) ? mission.completedMissionIds : [],
      },
    },
  };
};

const toTokenBackedPayload = (authUser) => ({
  status: "ok",
  user: {
    id: String(authUser?.sub || ""),
    name: String(authUser?.name || authUser?.preferred_username || "Operator"),
    email: String(authUser?.email || ""),
    role: String(authUser?.role || "user"),
    brand: "ZeroDay Guardian",
    assistant: "ZORVIX AI",
    settings: {
      theme: "dark",
      favoriteTools: [],
    },
    progress: {
      totalScore: 0,
      rank: "Initiate",
      completedMissionIds: [],
    },
  },
});

const findUserForRequest = async (authUser) => {
  const subject = String(authUser?.sub || "").trim();
  const email = String(authUser?.email || "").trim().toLowerCase();
  if (mongoose.Types.ObjectId.isValid(subject)) {
    const byId = await User.findById(subject);
    if (byId) return byId;
  }
  if (email) {
    return User.findOne({ email });
  }
  return null;
};

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const user = await findUserForRequest(req.user);
    if (!user) {
      res.json(toTokenBackedPayload(req.user));
      return;
    }
    res.json(toUserPayload(user));
  } catch (error) {
    next(error);
  }
});

router.patch("/", requireAuth, validateBody(updateSchema), async (req, res, next) => {
  try {
    const user = await findUserForRequest(req.user);
    if (!user) {
      res.status(404).json({ status: "error", code: "user_not_found", message: "User not found" });
      return;
    }
    if (req.validatedBody.name) user.name = req.validatedBody.name;
    user.settings = {
      ...(user.settings || {}),
      theme: "dark",
      favoriteTools: req.validatedBody.settings?.favoriteTools || user.settings?.favoriteTools || [],
    };
    await user.save();
    res.json(toUserPayload(user));
  } catch (error) {
    next(error);
  }
});

export default router;
