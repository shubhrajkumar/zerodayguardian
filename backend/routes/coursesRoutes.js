import { Router } from "express";
import { requireAuth } from "../src/middleware/auth.mjs";

const router = Router();

// GET /courses — Course catalog root
router.get("/",
  requireAuth,
  async (_req, res) => {
    try {
      return res.json({
        success: true,
        courses: [],
        total: 0,
        categories: ["Beginner", "Intermediate", "Advanced"],
        message: "Courses coming soon"
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
