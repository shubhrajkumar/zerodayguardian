import { Router } from "express";

const router = Router();

// GET /mission-control — Mission overview
router.get("/", (_req, res) => {
  res.json({
    success: true,
    missions: [],
    daily: [],
    weekly: [],
  });
});

export default router;
