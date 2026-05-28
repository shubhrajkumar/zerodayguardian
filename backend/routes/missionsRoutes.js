import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../src/middleware/auth.mjs";
import { validateQuery } from "../src/middleware/validate.mjs";
import { Mission } from "../src/models/Mission.mjs";
import { MissionProgress } from "../src/models/MissionProgress.mjs";

const router = Router();

const missionsQuerySchema = z.object({
  type: z.enum(["daily", "weekly", "special", "achievement", "story"]).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /missions — Active missions catalog
router.get("/",
  requireAuth,
  validateQuery(missionsQuerySchema),
  async (req, res) => {
    try {
      const query = req.validatedQuery;
      const now = new Date();
      const filter = {
        isActive: true,
        $or: [
          { expiresAt: { $gte: now } },
          { expiresAt: null },
        ],
        $and: [
          { $or: [{ startsAt: { $lte: now } }, { startsAt: null }] },
        ],
      };

      if (query.type) filter.type = query.type;
      if (query.difficulty) filter.difficulty = query.difficulty;

      const skip = (query.page - 1) * query.limit;

      const [missions, total] = await Promise.all([
        Mission.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(query.limit)
          .lean(),
        Mission.countDocuments(filter),
      ]);

      // Include user progress for each mission
      let userProgress = {};
      const missionIds = missions.map(m => m._id);
      if (missionIds.length > 0) {
        const progress = await MissionProgress.find({
          userId: req.user.sub,
          missionId: { $in: missionIds }
        }).lean();
        progress.forEach(p => { userProgress[String(p.missionId)] = p; });
      }

      return res.json({
        success: true,
        missions: missions.map(m => ({
          ...m,
          id: String(m._id),
          progress: userProgress[String(m._id)] || null,
        })),
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch missions",
      });
    }
  }
);

// GET /missions/daily — Daily missions
router.get("/daily",
  requireAuth,
  async (req, res) => {
    try {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86400000);

      const missions = await Mission.find({
        type: "daily",
        isActive: true,
        $or: [
          { startsAt: { $lte: now }, expiresAt: { $gte: now } },
          { startsAt: null, expiresAt: null },
          { startsAt: null, expiresAt: { $gte: now } },
          { startsAt: { $lte: now }, expiresAt: null },
        ],
      })
        .sort({ points: -1 })
        .limit(5)
        .lean();

      // Get user progress
      let userProgress = {};
      if (missions.length > 0) {
        const missionIds = missions.map(m => m._id);
        const progress = await MissionProgress.find({
          userId: req.user.sub,
          missionId: { $in: missionIds }
        }).lean();
        progress.forEach(p => { userProgress[String(p.missionId)] = p; });
      }

      // Calculate streak
      const completedToday = await MissionProgress.countDocuments({
        userId: req.user.sub,
        status: "completed",
        completedAt: { $gte: dayStart, $lt: dayEnd },
      });

      return res.json({
        success: true,
        missions: missions.map(m => ({
          ...m,
          id: String(m._id),
          progress: userProgress[String(m._id)] || null,
        })),
        expiresAt: dayEnd.toISOString(),
        streak: completedToday > 0 ? 1 : 0,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch daily missions",
      });
    }
  }
);

// GET /missions/weekly — Weekly missions
router.get("/weekly",
  requireAuth,
  async (req, res) => {
    try {
      const now = new Date();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

      const missions = await Mission.find({
        type: "weekly",
        isActive: true,
        $or: [
          { startsAt: { $lte: now }, expiresAt: { $gte: now } },
          { startsAt: null, expiresAt: null },
        ],
      })
        .sort({ points: -1 })
        .limit(3)
        .lean();

      let userProgress = {};
      if (missions.length > 0) {
        const missionIds = missions.map(m => m._id);
        const progress = await MissionProgress.find({
          userId: req.user.sub,
          missionId: { $in: missionIds }
        }).lean();
        progress.forEach(p => { userProgress[String(p.missionId)] = p; });
      }

      return res.json({
        success: true,
        missions: missions.map(m => ({
          ...m,
          id: String(m._id),
          progress: userProgress[String(m._id)] || null,
        })),
        expiresAt: weekEnd.toISOString(),
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch weekly missions",
      });
    }
  }
);

// POST /missions/:id/start — Start a mission
router.post("/:id/start",
  requireAuth,
  async (req, res) => {
    try {
      const mission = await Mission.findById(req.params.id);
      if (!mission) {
        return res.status(404).json({ success: false, error: "Mission not found" });
      }

      let progress = await MissionProgress.findOne({
        userId: req.user.sub,
        missionId: mission._id,
      });

      if (!progress) {
        progress = await MissionProgress.create({
          userId: req.user.sub,
          missionId: mission._id,
          status: "in_progress",
          startedAt: new Date(),
          progress: {
            totalObjectives: mission.objectives?.length || 0,
          },
        });
      }

      return res.json({ success: true, progress });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Failed to start mission",
      });
    }
  }
);

// POST /missions/:id/complete — Complete a mission
router.post("/:id/complete",
  requireAuth,
  async (req, res) => {
    try {
      const mission = await Mission.findById(req.params.id);
      if (!mission) {
        return res.status(404).json({ success: false, error: "Mission not found" });
      }

      const progress = await MissionProgress.findOne({
        userId: req.user.sub,
        missionId: mission._id,
      });

      if (!progress) {
        return res.status(404).json({ success: false, error: "Mission not started" });
      }

      progress.status = "completed";
      progress.completedAt = new Date();
      progress.xpEarned = mission.xpReward || 0;
      progress.pointsEarned = mission.points || 0;
      progress.progress.objectivesCompleted = progress.progress.totalObjectives;
      progress.progress.currentObjective = progress.progress.totalObjectives;
      await progress.save();

      // Increment mission completion count
      await Mission.findByIdAndUpdate(req.params.id, { $inc: { completionCount: 1 } });

      return res.json({
        success: true,
        progress,
        xpEarned: mission.xpReward,
        pointsEarned: mission.points,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Failed to complete mission",
      });
    }
  }
);

export default router;
