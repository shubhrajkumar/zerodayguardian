import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../src/middleware/auth.mjs";
import { validateQuery } from "../src/middleware/validate.mjs";
import { Course } from "../src/models/Course.mjs";

const router = Router();

const coursesQuerySchema = z.object({
  category: z.enum(["Beginner", "Intermediate", "Advanced", "Expert"]).optional(),
  topic: z.string().trim().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /courses — Course catalog with filtering and pagination
router.get("/",
  requireAuth,
  validateQuery(coursesQuerySchema),
  async (req, res) => {
    try {
      const query = req.validatedQuery;
      const filter = { isPublished: true };

      if (query.category) filter.category = query.category;
      if (query.topic) filter.topic = query.topic;
      if (query.difficulty) filter.difficulty = query.difficulty;
      if (query.search) {
        filter.$or = [
          { title: { $regex: query.search, $options: "i" } },
          { description: { $regex: query.search, $options: "i" } },
          { tags: { $in: [new RegExp(query.search, "i")] } },
        ];
      }

      const skip = (query.page - 1) * query.limit;

      const [courses, total] = await Promise.all([
        Course.find(filter)
          .select("-modules.content -modules.quizQuestions.correctAnswer")
          .sort({ publishedAt: -1 })
          .skip(skip)
          .limit(query.limit)
          .lean(),
        Course.countDocuments(filter),
      ]);

      // Aggregate available filters
      const [categories, topics, difficulties] = await Promise.all([
        Course.distinct("category", { isPublished: true }),
        Course.distinct("topic", { isPublished: true }),
        Course.distinct("difficulty", { isPublished: true }),
      ]);

      return res.json({
        success: true,
        courses: courses.map(c => ({ ...c, id: String(c._id) })),
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        filters: {
          categories,
          topics,
          difficulties,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch courses",
      });
    }
  }
);

// GET /courses/:slug — Single course detail
router.get("/:slug",
  requireAuth,
  async (req, res) => {
    try {
      const course = await Course.findOne({
        slug: req.params.slug,
        isPublished: true,
      }).lean();

      if (!course) {
        return res.status(404).json({
          success: false,
          error: "Course not found",
        });
      }

      return res.json({
        success: true,
        course: { ...course, id: String(course._id) },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch course",
      });
    }
  }
);

export default router;
