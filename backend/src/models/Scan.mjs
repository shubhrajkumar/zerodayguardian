import mongoose from "mongoose";

const ScanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    url: { type: String, required: true, trim: true },
    result: { type: Object, default: {} },
    risk: { type: String, default: "low", index: true },
    riskLevel: { type: String, default: "low", index: true },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "scans",
  }
);

ScanSchema.index({ userId: 1, createdAt: -1 });
ScanSchema.index({ userId: 1, riskLevel: 1, createdAt: -1 });

ScanSchema.pre("save", function syncRisk(next) {
  const normalized = String(this.riskLevel || this.risk || "low").toLowerCase();
  this.riskLevel = normalized;
  this.risk = normalized;
  next();
});

export const Scan = mongoose.models.Scan || mongoose.model("Scan", ScanSchema);
