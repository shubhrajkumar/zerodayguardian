import { Router } from "express";
import { requireAuth } from "../src/middleware/auth.mjs";

const router = Router();

// GET /labs/overview — Labs catalog overview
router.get("/overview", (_req, res) => {
  res.json({
    success: true,
    labs: [],
    total: 0,
    categories: ["Web", "Network", "Crypto", "Forensics", "OSINT"],
    message: "Labs coming soon",
  });
});

// GET /labs/sandbox — Sandbox lab listing (stub)
router.get("/sandbox",
  requireAuth,
  async (_req, res) => {
    try {
      return res.json({
        success: true,
        sandbox: {
          status: "coming_soon",
          available: false,
          message: "Interactive sandbox launching soon",
          estimatedLaunch: "Q2 2025"
        }
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Server error"
      });
    }
  }
);

// GET /labs/sandbox/status — Sandbox health
router.get("/sandbox/status",
  requireAuth,
  async (_req, res) => {
    try {
      return res.json({
        success: true,
        status: "offline",
        ready: false,
        health: "ok"
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
