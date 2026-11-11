import { z } from "@hono/zod-openapi";

import { WARNING_LIMITS } from "@/lib/moderation/warnings";

const wordsSchema = (maxLength: number) =>
  z.array(
    z.object({
      languageCode: z.string(),
      value: z.string().trim().max(maxLength),
    }),
  );

export const reasonBody = z.object({
  title: z
    .array(
      z.object({
        languageCode: z.string(),
        value: z
          .string()
          .trim()
          .min(1)
          .max(WARNING_LIMITS.reasonTitleMaxLength),
      }),
    )
    .min(1),
  description: wordsSchema(WARNING_LIMITS.reasonDescriptionMaxLength),
  message: wordsSchema(WARNING_LIMITS.reasonMessageMaxLength),
  points: z.number().int().min(0).max(WARNING_LIMITS.maxPoints),
  expiresAfterHours: z
    .number()
    .int()
    .min(1)
    .max(WARNING_LIMITS.maxDurationHours)
    .nullable(),
  enabled: z.boolean(),
});
