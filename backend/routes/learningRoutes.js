import { Router } from "express";
import { requireAuth } from "../src/middleware/auth.mjs";

const router = Router();

// GET /learning — Root handler returning learning index
router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Learning API",
    endpoints: {
      paths: "/api/learning/paths"
    },
    paths: [],
    total: 0
  });
});

// GET /learning/paths — Learning paths listing
router.get("/paths",
  requireAuth,
  async (_req, res) => {
    try {
      return res.json({
        success: true,
        paths: [],
        total: 0,
        message: "Learning paths coming soon"
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
