import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
}).strict();

export const googleLoginSchema = z.object({
  credential: z.string().trim().min(20).max(4096),
});

export const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1).optional(),
}).strict();

export const logoutSchema = z.object({
  refreshToken: z.string().trim().min(1).optional(),
}).strict();

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(6).max(6),
}).strict();

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
}).strict();

export const resetPasswordSchema = z.object({
  email: z.string().min(1, "Email is required"),
  otp: z.string().min(1, "OTP is required"),
  newPassword: z.string().min(1, "New password is required"),
});
