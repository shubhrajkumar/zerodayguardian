import jwt from "jsonwebtoken";
import { env } from "../config/env.mjs";
import { User } from "../models/User.mjs";
import { getUserById } from "../../services/security-service/authService.mjs";

/**
 * Mongoose-based auth helpers — Google-only mode.
 * Traditional login/register/verifyPassword have been removed.
 */

export const signJwt = (user) => {
  if (!env.jwtSecret) {
    const error = new Error("JWT secret missing");
    error.status = 500;
    throw error;
  }
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, name: user.name, role: user.role || "user" },
    env.jwtSecret,
    { expiresIn: "7d" }
  );
};

/**
 * Look up a user by ID via Mongoose (for legacy code paths that still use it).
 */
export const findUserById = async (id) => {
  try {
    return await getUserById(id);
  } catch {
    return null;
  }
};
