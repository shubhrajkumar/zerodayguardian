import { Router } from "express";

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
router.get("/sandbox", (_req, res) => {
  res.json({
    success: true,
    sandbox: {
      status: "initializing",
      available: false,
      message: "Sandbox environment coming soon",
    },
  });
});

// GET /labs/sandbox/status — Sandbox health
router.get("/sandbox/status", (_req, res) => {
  res.json({
    success: true,
    status: "offline",
    ready: false,
  });
});

export default router;
