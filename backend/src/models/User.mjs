import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    googleId: { type: String, default: null, unique: true, sparse: true },
    password: { type: String, required: false, default: null },
    avatarUrl: { type: String, default: "" },
    role: { type: String, default: "user" },
    authProvider: { type: String, default: "google" },
    emailVerified: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    otp: { type: String, default: null },
    otpExpires: { type: Date, default: null },
    resetOtp: { type: String, default: null },
    resetOtpExpires: { type: Date, default: null },
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
UserSchema.index({ googleId: 1 }, { sparse: true });

export const User = mongoose.models.User || mongoose.model("User", UserSchema);
