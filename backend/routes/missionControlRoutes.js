import { Router } from "express";
import { requireAuth } from "../src/middleware/auth.mjs";

const router = Router();

// GET /mission-control — Mission overview
router.get("/",
  requireAuth,
  async (_req, res) => {
    try {
      return res.json({
        success: true,
        missions: [],
        daily: [],
        weekly: [],
        streak: 0,
        message: "Missions coming soon"
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Server error"
      });
    }
  }
);

export default router;
