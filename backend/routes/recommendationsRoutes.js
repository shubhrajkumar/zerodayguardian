import { Router } from "express";
import { authenticateToken } from "../src/middleware/auth.mjs";

const router = Router();

// GET /recommendations — Personalized learning recommendations
router.get("/", authenticateToken, (_req, res) => {
  res.json({
    success: true,
    recommendations: [],
    message: "Complete more labs to get recommendations",
  });
});

export default router;
