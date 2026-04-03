import { z } from "zod";

export const telemetryEventSchema = z.object({
  type: z.string().min(2).max(80),
  query: z.string().max(2000).optional().default(""),
  tool: z.string().max(120).optional().default(""),
  durationMs: z.number().min(0).max(3_600_000).optional().default(0),
  depth: z.number().min(0).max(20).optional().default(0),
  success: z.boolean().optional().default(true),
  metadata: z.record(z.any()).optional().default({}),
});

export const promptRecommendationQuerySchema = z.object({
  q: z.string().max(2000).optional().default(""),
  regenerate: z
    .string()
    .optional()
    .transform((v) => String(v || "").toLowerCase() === "true"),
});

export const dorkBuilderSchema = z.object({
  target: z.string().min(3).max(253).regex(/^[A-Za-z0-9.-]+$/, "Target must be a domain-like value"),
  category: z.enum([
    "File exposure",
    "Login pages",
    "Directory listing",
    "PDF/Docs discovery",
  ]),
});

export const hashIdentifySchema = z.object({
  hash: z.string().trim().min(1, "Hash value is required").min(8, "Hash value is too short to identify").max(255, "Hash value exceeds supported length"),
});

export const passwordStrengthSchema = z.object({
  password: z.string().min(1).max(512),
});

export const headersAnalyzeSchema = z.object({
  headers: z.string().min(1).max(20000),
});

export const headersUrlAnalyzeSchema = z.object({
  url: z.string().url().max(2048),
});

export const metadataAnalyzeSchema = z.object({
  input: z.string().min(1).max(1000).regex(/^[^<>]+$/, "Invalid filename input"),
});

export const metadataFileAnalyzeSchema = z.object({
  filename: z.string().min(1).max(255).regex(/^[^<>:"|?*]+$/, "Invalid filename"),
  mimeType: z.string().min(1).max(120),
  size: z.number().min(1).max(2_000_000),
  base64: z.string().min(8).max(4_000_000),
});

export const subdomainSimSchema = z.object({
  target: z.string().min(3).max(253).regex(/^[A-Za-z0-9.-]+$/, "Target must be a domain-like value"),
});

export const webScanSchema = z.object({
  url: z.string().trim().min(3).max(2048),
  report: z
    .object({
      template: z.enum(["classic", "dark", "neon"]).optional().default("classic"),
      brandName: z.string().trim().max(80).optional().default("ZeroDay Guardian"),
      brandTagline: z.string().trim().max(140).optional().default("Security posture snapshot"),
      accent: z
        .string()
        .trim()
        .regex(/^#?[0-9a-fA-F]{6}$/, "Accent color must be a hex value")
        .optional()
        .default("#22d3ee"),
    })
    .optional()
    .default({}),
});

export const labProgressSchema = z.object({
  labId: z.string().min(1).max(120),
  status: z.enum(["started", "completed", "failed"]),
  durationSec: z.number().min(0).max(86_400).optional().default(0),
  difficulty: z.number().min(1).max(5).optional().default(2),
});

export const newsQuerySchema = z.object({
  category: z.enum(["all", "zero-day", "breaches", "ai-security", "malware", "threat-intel"]).optional().default("all"),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v || 20);
      return Number.isFinite(n) ? Math.max(1, Math.min(60, Math.floor(n))) : 20;
    }),
  refresh: z
    .string()
    .optional()
    .transform((v) => String(v || "").trim().toLowerCase() === "true"),
});

export const blogQuerySchema = z.object({
  category: z.enum(["all", "zero-day", "breaches", "ai-security", "malware", "threat-intel"]).optional().default("all"),
  q: z.string().max(200).optional().default(""),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v || 30);
      return Number.isFinite(n) ? Math.max(1, Math.min(100, Math.floor(n))) : 30;
    }),
});

export const threadCreateSchema = z.object({
  title: z.string().min(4).max(180),
  content: z.string().min(8).max(4000),
  roleTag: z.enum(["Beginner", "Pentester", "Analyst"]).optional().default("Beginner"),
});

export const threadReplySchema = z.object({
  parentId: z.string().min(8).max(80),
  content: z.string().min(2).max(2000),
});

export const threadVoteSchema = z.object({
  threadId: z.string().min(8).max(80),
  direction: z.enum(["up"]),
});

export const threadListQuerySchema = z.object({
  sort: z.enum(["trending", "new", "unanswered"]).optional().default("trending"),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v || 40);
      return Number.isFinite(n) ? Math.max(1, Math.min(100, Math.floor(n))) : 40;
    }),
});

export const trainingLabRunSchema = z.object({
  labId: z.enum([
    "beginner-password-strength",
    "beginner-xss-sandbox",
    "beginner-sqli-demo",
    "beginner-portscan-visual",
  ]),
  input: z
    .object({
      password: z.string().max(512).optional(),
      payload: z.string().max(4000).optional(),
      target: z.string().max(253).optional(),
    })
    .default({}),
});

export const trainingLabCompleteSchema = z.object({
  labId: z.enum([
    "beginner-password-strength",
    "beginner-xss-sandbox",
    "beginner-sqli-demo",
    "beginner-portscan-visual",
  ]),
  score: z.number().min(0).max(100),
});

export const leaderboardQuerySchema = z.object({
  period: z.enum(["alltime", "weekly"]).optional().default("alltime"),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v || 20);
      return Number.isFinite(n) ? Math.max(1, Math.min(100, Math.floor(n))) : 20;
    }),
});
