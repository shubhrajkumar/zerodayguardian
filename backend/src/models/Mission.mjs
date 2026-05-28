import mongoose from "mongoose";

const MissionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    description: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["daily", "weekly", "special", "achievement", "story"],
      required: true,
      index: true,
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "expert"],
      default: "beginner",
      index: true,
    },
    category: {
      type: String,
      enum: ["Recon", "Exploitation", "Defense", "Analysis", "OSINT", "Cryptography", "Social Engineering"],
      default: "Recon",
    },
    points: { type: Number, default: 50, min: 0 },
    xpReward: { type: Number, default: 100, min: 0 },
    requirements: {
      minLevel: { type: Number, default: 1, min: 1 },
      prerequisiteMissionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Mission" }],
      requiredLabCompletions: { type: Number, default: 0, min: 0 },
    },
    objectives: [
      {
        description: { type: String, required: true },
        order: { type: Number, default: 0 },
        optional: { type: Boolean, default: false },
      },
    ],
    tips: [{ type: String, trim: true }],
    tags: [{ type: String, trim: true, lowercase: true }],
    isActive: { type: Boolean, default: true, index: true },
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    maxCompletions: { type: Number, default: 0, min: 0 }, // 0 = unlimited
    completionCount: { type: Number, default: 0, min: 0 },
    badgeIcon: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "missions",
  }
);

MissionSchema.index({ type: 1, isActive: 1, expiresAt: 1 });
MissionSchema.index({ type: 1, startsAt: 1, expiresAt: 1 });
MissionSchema.index({ tags: 1 });
MissionSchema.index({ difficulty: 1, isActive: 1 });
MissionSchema.index({ completionCount: -1 });

export const Mission = mongoose.models.Mission || mongoose.model("Mission", MissionSchema);
