import { Router } from "express";
import { requireAuth } from "../src/middleware/auth.mjs";

const router = Router();

// GET /missions — Root handler returning missions index
router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Missions API",
    endpoints: {
      daily: "/api/missions/daily",
      weekly: "/api/missions/weekly"
    },
    missions: [],
    daily: [],
    weekly: [],
    streak: 0
  });
});

// GET /missions/daily — Daily missions listing
router.get("/daily",
  requireAuth,
  async (_req, res) => {
    try {
      return res.json({
        success: true,
        missions: [],
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        message: "Daily missions coming soon"
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Server error"
      });
    }
  }
);

// GET /missions/weekly — Weekly missions listing
router.get("/weekly",
  requireAuth,
  async (_req, res) => {
    try {
      return res.json({
        success: true,
        missions: [],
        expiresAt: new Date(Date.now() + 604800000).toISOString(),
        message: "Weekly missions coming soon"
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
