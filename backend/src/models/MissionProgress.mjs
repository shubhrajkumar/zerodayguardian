import mongoose from "mongoose";

const MissionProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: "User" },
    missionId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: "Mission" },
    status: {
      type: String,
      enum: ["assigned", "in_progress", "completed", "expired", "failed"],
      default: "assigned",
      index: true,
    },
    progress: {
      currentObjective: { type: Number, default: 0, min: 0 },
      objectivesCompleted: { type: Number, default: 0, min: 0 },
      totalObjectives: { type: Number, default: 0, min: 0 },
    },
    assignedAt: { type: Date, default: Date.now },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    xpEarned: { type: Number, default: 0, min: 0 },
    pointsEarned: { type: Number, default: 0, min: 0 },
    streakBonus: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "mission_progress",
  }
);

MissionProgressSchema.index({ userId: 1, status: 1 });
MissionProgressSchema.index({ userId: 1, missionId: 1 }, { unique: true });
MissionProgressSchema.index({ missionId: 1, status: 1 });
MissionProgressSchema.index({ userId: 1, type: 1, createdAt: -1 });
MissionProgressSchema.index({ completedAt: -1 });

export const MissionProgress = mongoose.models.MissionProgress || mongoose.model("MissionProgress", MissionProgressSchema);
