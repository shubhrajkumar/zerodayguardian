import { Router } from "express";

const router = Router();

// GET /recommendations — Personalized learning recommendations
router.get("/", (_req, res) => {
  res.json({
    success: true,
    recommendations: [],
    message: "Complete more labs to get recommendations",
  });
});

export default router;
