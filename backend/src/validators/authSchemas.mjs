import { z } from "zod";

const strongPasswordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(200)
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/\d/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a symbol");

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: strongPasswordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
  rememberMe: z.boolean().optional(),
});

export const googleLoginSchema = z.object({
  credential: z.string().trim().min(20).max(4096),
});

export const sendOtpSchema = z.object({
  email: z.string().trim().email().max(200),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email().max(200),
  otp: z.string().trim().regex(/^\d{6}$/, "OTP must be 6 digits"),
  password: strongPasswordSchema,
});

export const refreshSchema = z.object({}).strict();

export const logoutSchema = z.object({}).strict();

export const registerSchema = signupSchema;
export const forgotPasswordSchema = sendOtpSchema;
