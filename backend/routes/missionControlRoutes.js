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

// POST /mission-control/actions — Log a mission control action
router.post("/actions",
  requireAuth,
  async (req, res) => {
    try {
      const { action_type, target, metadata } = req.body;
      return res.json({
        success: true,
        action: {
          action_type: action_type || "unknown",
          target: target || null,
          metadata: metadata || {},
          recorded_at: new Date().toISOString()
        },
        points_awarded: 0,
        message: "Action recorded"
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
