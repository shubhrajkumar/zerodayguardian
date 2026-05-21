import { z } from "zod";

export const assistantProfileSchema = z.object({
  voiceId: z.string().max(160).optional(),
  voiceLabel: z.string().max(160).optional(),
  voiceGender: z.enum(["male", "female", "neutral", "unknown"]).optional(),
  accent: z.string().max(80).optional(),
  tone: z.enum(["professional", "motivational", "coach", "friendly"]).optional(),
  style: z.enum(["balanced", "concise", "deep-dive"]).optional(),
  audience: z.enum(["general", "freelancer", "business", "student", "operator", "security_analyst"]).optional(),
  expressiveness: z.number().min(0).max(1.5).optional(),
  speechRate: z.number().min(0.7).max(1.4).optional(),
  pitch: z.number().min(0.6).max(1.5).optional(),
  transport: z.enum(["auto", "sse", "webrtc"]).optional(),
  privateMode: z.boolean().optional(),
});

export const topicSchema = z.object({
  topic: z
    .object({
      id: z.string().min(1).max(120),
      title: z.string().min(1).max(180),
      query: z.string().max(400).optional().default(""),
      tags: z.array(z.string().max(80)).max(20).optional().default([]),
    })
    .nullable(),
});

const chatAttachmentSchema = z.object({
  filename: z.string().min(1).max(255).regex(/^[^<>:"|?*]+$/, "Invalid filename"),
  mimeType: z.string().min(1).max(120),
  size: z.number().min(1).max(25_000_000),
  base64: z.string().min(8).max(35_000_000),
});

export const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  previewOnly: z.boolean().optional(),
  assistantProfile: assistantProfileSchema.optional(),
  attachments: z.array(chatAttachmentSchema).max(1).optional().default([]),
});

export const chatStreamSchema = z
  .object({
    message: z.string().min(1).max(4000).optional(),
    streamId: z.string().uuid().optional(),
    assistantProfile: assistantProfileSchema.optional(),
    transport: z.enum(["auto", "sse", "webrtc"]).optional(),
    attachments: z.array(chatAttachmentSchema).max(1).optional().default([]),
  });

export const preferencesSchema = z.object({
  assistantProfile: assistantProfileSchema,
});

export const previewSchema = z.object({
  message: z.string().min(1).max(4000),
  assistantProfile: assistantProfileSchema.optional(),
  attachments: z.array(chatAttachmentSchema).max(1).optional().default([]),
  topic: z
    .object({
      id: z.string().min(1).max(120),
      title: z.string().min(1).max(180),
      query: z.string().max(400).optional().default(""),
      tags: z.array(z.string().max(80)).max(20).optional().default([]),
    })
    .nullable()
    .optional(),
});

export const labRunSchema = z.object({
  labId: z.string().trim().min(1, "labId is required").max(80),
  command: z.string().trim().min(1, "command is required").max(200),
});

export const historyClearSchema = z.object({
  scope: z.enum(["session", "account"]).optional().default("session"),
});

export const historyDeleteSessionSchema = z.object({
  sessionId: z.string().min(12).max(120),
});
