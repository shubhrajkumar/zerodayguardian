import mongoose from "mongoose";

const CourseModuleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, lowercase: true },
  description: { type: String, default: "" },
  content: { type: String, default: "" },
  type: {
    type: String,
    enum: ["lesson", "quiz", "lab", "challenge", "video", "reading"],
    default: "lesson",
  },
  duration: { type: Number, default: 15, min: 1 }, // minutes
  order: { type: Number, default: 0 },
  points: { type: Number, default: 50, min: 0 },
  resources: [
    {
      title: { type: String, trim: true },
      url: { type: String, trim: true },
    },
  ],
  quizQuestions: [
    {
      question: { type: String, required: true },
      options: [{ type: String }],
      correctAnswer: { type: Number },
      explanation: { type: String, default: "" },
    },
  ],
  labReference: { type: String, default: "" }, // slug of related lab
});

const CourseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    description: { type: String, required: true, trim: true },
    shortDescription: { type: String, default: "", maxlength: 200 },
    category: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced", "Expert"],
      default: "Beginner",
      index: true,
    },
    topic: {
      type: String,
      enum: [
        "Web Security", "Network Security", "Cryptography", "Forensics",
        "OSINT", "Reverse Engineering", "Cloud Security", "IoT Security",
        "Social Engineering", "Python for Security", "Linux Security",
        "CTF Preparation", "Blue Team", "Red Team", "General"
      ],
      default: "General",
      index: true,
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "expert"],
      default: "beginner",
    },
    icon: { type: String, default: "book-open" },
    color: { type: String, default: "#00d4ff" },
    prerequisites: [{ type: String, trim: true }],
    learningOutcomes: [{ type: String, trim: true }],
    tags: [{ type: String, trim: true, lowercase: true }],
    totalDuration: { type: Number, default: 0, min: 0 }, // total minutes
    totalPoints: { type: Number, default: 0, min: 0 },
    moduleCount: { type: Number, default: 0, min: 0 },
    modules: [CourseModuleSchema],
    isActive: { type: Boolean, default: true, index: true },
    isPublished: { type: Boolean, default: false, index: true },
    enrollmentCount: { type: Number, default: 0, min: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    coverImage: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "courses",
  }
);

CourseSchema.index({ isPublished: 1, category: 1 });
CourseSchema.index({ topic: 1, isPublished: 1 });
CourseSchema.index({ tags: 1 });
CourseSchema.index({ publishedAt: -1 });
CourseSchema.index({ enrollmentCount: -1 });

export const Course = mongoose.models.Course || mongoose.model("Course", CourseSchema);
