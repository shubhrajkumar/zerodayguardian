import mongoose from "mongoose";

const LabSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["Web", "Network", "Crypto", "Forensics", "OSINT", "Reverse Engineering", "Cloud", "IoT"],
      required: true,
      index: true,
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "expert"],
      default: "beginner",
      index: true,
    },
    duration: { type: Number, default: 30, min: 5, max: 480 }, // minutes
    points: { type: Number, default: 100, min: 0 },
    instructions: { type: String, default: "" },
    hints: [{ type: String, trim: true }],
    tags: [{ type: String, trim: true, lowercase: true }],
    prerequisites: [{ type: String, trim: true }],
    learningObjectives: [{ type: String, trim: true }],
    resources: [
      {
        title: { type: String, trim: true },
        url: { type: String, trim: true },
        type: { type: String, enum: ["article", "video", "tool", "reference"], default: "article" },
      },
    ],
    dockerImage: { type: String, default: "" },
    portMapping: { type: Map, of: Number, default: {} },
    isActive: { type: Boolean, default: true, index: true },
    completionCount: { type: Number, default: 0, min: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "labs",
  }
);

LabSchema.index({ isActive: 1, difficulty: 1 });
LabSchema.index({ isActive: 1, category: 1, difficulty: 1 });
LabSchema.index({ tags: 1 });
LabSchema.index({ publishedAt: -1 });
LabSchema.index({ completionCount: -1 });

export const Lab = mongoose.models.Lab || mongoose.model("Lab", LabSchema);
