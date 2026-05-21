import { z } from "zod";

export const scanSummaryQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((value) => {
      const n = Number(value || 10);
      return Number.isFinite(n) ? Math.max(1, Math.min(20, Math.floor(n))) : 10;
    }),
});
