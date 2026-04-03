import mongoose from "mongoose";

const OsintQuerySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    query: { type: String, required: true, trim: true },
    normalizedQuery: { type: String, required: true, trim: true, lowercase: true },
    targetType: { type: String, enum: ["email", "domain", "ip"], required: true, index: true },
    riskLevel: { type: String, enum: ["low", "medium", "high"], default: "low", index: true },
    verified: { type: Boolean, default: false, index: true },
    dedupeKey: { type: String, required: true, trim: true, index: true },
    requestCount: { type: Number, default: 1, min: 1 },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    modules: { type: [String], default: [] },
    result: { type: Object, default: {} },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" }, collection: "osint_queries" }
);

OsintQuerySchema.index({ userId: 1, createdAt: -1 });
OsintQuerySchema.index({ userId: 1, targetType: 1, createdAt: -1 });
OsintQuerySchema.index({ userId: 1, riskLevel: 1, createdAt: -1 });
OsintQuerySchema.index({ userId: 1, dedupeKey: 1, updatedAt: -1 });

export const OsintQuery = mongoose.models.OsintQuery || mongoose.model("OsintQuery", OsintQuerySchema);
