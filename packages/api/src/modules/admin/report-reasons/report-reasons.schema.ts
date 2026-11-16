import { z } from "@hono/zod-openapi";

import { MODERATION_LIMITS } from "@/lib/moderation/const";

const titleSchema = z
  .array(
    z.object({
      languageCode: z.string(),
      value: z
        .string()
        .trim()
        .min(1)
        .max(MODERATION_LIMITS.reasonTitleMaxLength),
    }),
  )
  .min(1);

export const descriptionSchema = z.array(
  z.object({
    languageCode: z.string(),
    value: z.string().trim().max(MODERATION_LIMITS.reasonDescriptionMaxLength),
  }),
);

export const reasonBody = z.object({
  title: titleSchema,
  description: descriptionSchema,
  requiresDetails: z.boolean(),
});

export const idParams = z.object({
  id: z.coerce.number().int().positive().openapi({ example: 1 }),
});
