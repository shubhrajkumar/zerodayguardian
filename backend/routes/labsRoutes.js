import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../src/middleware/auth.mjs";
import { validateQuery } from "../src/middleware/validate.mjs";
import { Lab } from "../src/models/Lab.mjs";
import { LabProgress } from "../src/models/LabProgress.mjs";

const router = Router();

const labsQuerySchema = z.object({
  category: z.string().trim().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(["createdAt", "completionCount", "averageRating", "difficulty", "title"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// GET /labs — Labs catalog with filtering and pagination
router.get("/",
  validateQuery(labsQuerySchema),
  async (req, res) => {
    try {
      const query = req.validatedQuery;
      const filter = { isActive: true };

      if (query.category) filter.category = query.category;
      if (query.difficulty) filter.difficulty = query.difficulty;
      if (query.search) {
        filter.$or = [
          { title: { $regex: query.search, $options: "i" } },
          { description: { $regex: query.search, $options: "i" } },
          { tags: { $in: [new RegExp(query.search, "i")] } },
        ];
      }

      const sortOrder = query.order === "asc" ? 1 : -1;
      const skip = (query.page - 1) * query.limit;

      const [labs, total] = await Promise.all([
        Lab.find(filter)
          .select("-instructions")
          .sort({ [query.sort]: sortOrder })
          .skip(skip)
          .limit(query.limit)
          .lean(),
        Lab.countDocuments(filter),
      ]);

      // If user is authenticated, include their progress
      let userProgress = {};
      if (req.user?.sub) {
        const labIds = labs.map(l => l._id);
        const progress = await LabProgress.find({
          userId: req.user.sub,
          labId: { $in: labIds }
        }).select("labId status score completedAt").lean();
        progress.forEach(p => { userProgress[String(p.labId)] = p; });
      }

      const categories = await Lab.distinct("category", { isActive: true });
      const difficulties = await Lab.distinct("difficulty", { isActive: true });

      return res.json({
        success: true,
        labs: labs.map(lab => ({
          ...lab,
          id: String(lab._id),
          progress: userProgress[String(lab._id)] || null,
        })),
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        categories,
        difficulties,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch labs",
        message: err.message,
      });
    }
  }
);

// GET /labs/overview — Labs summary with fallback categories (NO auth required)
router.get("/overview", async (_req, res) => {
  try {
    const [total, categoryCounts] = await Promise.all([
      Lab.countDocuments({ isActive: true }).catch(() => 0),
      Lab.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).catch(() => []),
    ]);

    const defaultCategories = ["Web", "Network", "Crypto", "Forensics", "OSINT"];
    const dbCategories = categoryCounts.map(c => ({ name: c._id, count: c.count }));
    const categories = dbCategories.length > 0
      ? dbCategories
      : defaultCategories.map(name => ({ name, count: 0 }));

    return res.json({
      success: true,
      labs: [],
      total,
      categories,
      message: total > 0 ? undefined : "Labs coming soon",
    });
  } catch (err) {
    return res.json({
      success: true,
      labs: [],
      total: 0,
      categories: ["Web", "Network", "Crypto", "Forensics", "OSINT"].map(name => ({ name, count: 0 })),
      message: "Labs coming soon",
    });
  }
});

// GET /labs/sandbox — Sandbox info (NO auth required — must be BEFORE /:id!)
router.get("/sandbox", async (_req, res) => {
  try {
    return res.json({
      success: true,
      sandbox: {
        status: "initializing",
        available: false,
        message: "Sandbox environment coming soon",
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// GET /labs/sandbox/status — Sandbox health (NO auth required — must be BEFORE /:id!)
router.get("/sandbox/status", async (_req, res) => {
  try {
    return res.json({
      success: true,
      status: "offline",
      ready: false,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// ── Dynamic routes (with :id param) — placed AFTER static routes ──

// GET /labs/:id — Single lab detail
router.get("/:id",
  requireAuth,
  async (req, res) => {
    try {
      const lab = await Lab.findOne({
        _id: req.params.id,
        isActive: true,
      }).lean();

      if (!lab) {
        return res.status(404).json({
          success: false,
          error: "Lab not found",
        });
      }

      // Get user progress
      let progress = null;
      if (req.user?.sub) {
        progress = await LabProgress.findOne({
          userId: req.user.sub,
          labId: lab._id,
        }).lean();
      }

      return res.json({
        success: true,
        lab: { ...lab, id: String(lab._id) },
        progress,
      });
    } catch (err) {
      if (err.name === "CastError") {
        return res.status(400).json({
          success: false,
          error: "Invalid lab ID format",
        });
      }
      return res.status(500).json({
        success: false,
        error: "Failed to fetch lab",
      });
    }
  }
);

// POST /labs/:id/start — Start a lab
router.post("/:id/start",
  requireAuth,
  async (req, res) => {
    try {
      const lab = await Lab.findById(req.params.id);
      if (!lab) {
        return res.status(404).json({ success: false, error: "Lab not found" });
      }

      let progress = await LabProgress.findOne({
        userId: req.user.sub,
        labId: lab._id,
      });

      if (!progress) {
        progress = await LabProgress.create({
          userId: req.user.sub,
          labId: lab._id,
          status: "in_progress",
          startedAt: new Date(),
          attempts: 1,
        });
      } else if (progress.status === "not_started") {
        progress.status = "in_progress";
        progress.startedAt = new Date();
        progress.attempts += 1;
        await progress.save();
      }

      return res.json({ success: true, progress });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Failed to start lab",
      });
    }
  }
);

// POST /labs/:id/complete — Complete a lab
router.post("/:id/complete",
  requireAuth,
  async (req, res) => {
    try {
      const { score, timeSpent, flagsSubmitted } = req.body;

      const progress = await LabProgress.findOne({
        userId: req.user.sub,
        labId: req.params.id,
      });

      if (!progress) {
        return res.status(404).json({ success: false, error: "Lab progress not found" });
      }

      progress.status = "completed";
      progress.completedAt = new Date();
      if (score != null) progress.score = Math.max(0, Math.min(100, Number(score)));
      if (timeSpent != null) progress.timeSpent = Number(timeSpent);
      if (flagsSubmitted) progress.flagsSubmitted = flagsSubmitted;
      await progress.save();

      // Increment lab completion count
      await Lab.findByIdAndUpdate(req.params.id, { $inc: { completionCount: 1 } });

      return res.json({ success: true, progress });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Failed to complete lab",
      });
    }
  }
);

export default router;
