import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true },
    role: { type: String, default: "user" },
    resetOtp: { type: String, default: null },
    resetOtpExpire: { type: Date, default: null },
    settings: {
      theme: { type: String, default: "dark" },
      favoriteTools: { type: [String], default: [] },
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "users",
    strict: false,
  }
);

UserSchema.index({ role: 1, createdAt: -1 });
UserSchema.index({ resetOtpExpire: 1 });

export const User = mongoose.models.User || mongoose.model("User", UserSchema);
