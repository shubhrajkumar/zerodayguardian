import { Router } from "express";
import { authenticateToken } from "../src/middleware/auth.mjs";

const router = Router();

// GET /mission-control — Mission overview
router.get("/", authenticateToken, (_req, res) => {
  res.json({
    success: true,
    missions: [],
    daily: [],
    weekly: [],
  });
});

export default router;
