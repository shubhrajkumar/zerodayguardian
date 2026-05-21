import jwt from "jsonwebtoken";
import { env } from "../config/env.mjs";
import { User } from "../models/User.mjs";
import { loginUser, registerUser, verifyPassword } from "../../services/security-service/authService.mjs";

export const registerWithMongoose = async (payload) => registerUser(payload);

export const loginWithMongoose = async (payload) => loginUser(payload);

export const signJwt = (user) => {
  if (!env.jwtSecret) {
    const error = new Error("JWT secret missing");
    error.status = 500;
    throw error;
  }
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, name: user.name, role: user.role || "user" },
    env.jwtSecret,
    { expiresIn: "15m" }
  );
};

export const verifyMongoosePassword = async ({ email, password }) => {
  const safeEmail = String(email || "").toLowerCase().trim();
  const user = await User.findOne({ email: safeEmail }).lean();
  if (!user) return false;
  return verifyPassword(password, user.passwordHash || user.password || "");
};
