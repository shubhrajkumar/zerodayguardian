import { z } from "zod";

export const listQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((value) => {
      const n = Number(value || 20);
      return Number.isFinite(n) ? Math.max(1, Math.min(50, Math.floor(n))) : 20;
    }),
});
