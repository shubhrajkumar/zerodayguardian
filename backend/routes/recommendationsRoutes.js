import { Router } from "express";
import { requireAuth } from "../src/middleware/auth.mjs";

const router = Router();

// GET /recommendations — Personalized learning recommendations
router.get("/",
  requireAuth,
  async (_req, res) => {
    try {
      return res.json({
        success: true,
        recommendations: [],
        personalized: false,
        message: "Complete labs to unlock recommendations"
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
