import mongoose from "mongoose";

const LabProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: "User" },
    labId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: "Lab" },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed", "failed"],
      default: "not_started",
      index: true,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0, min: 0 },
    score: { type: Number, default: 0, min: 0, max: 100 },
    timeSpent: { type: Number, default: 0, min: 0 }, // seconds
    hintsUsed: { type: Number, default: 0, min: 0 },
    flagsSubmitted: [{ type: String }],
    notes: { type: String, default: "" },
    rating: { type: Number, default: null, min: 1, max: 5 },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "lab_progress",
  }
);

LabProgressSchema.index({ userId: 1, status: 1 });
LabProgressSchema.index({ userId: 1, labId: 1 }, { unique: true });
LabProgressSchema.index({ labId: 1, status: 1 });
LabProgressSchema.index({ completedAt: -1 });

export const LabProgress = mongoose.models.LabProgress || mongoose.model("LabProgress", LabProgressSchema);
