import { z } from "@hono/zod-openapi";

import { errorSchema, json } from "@/api/modules/moderation/moderation.schema";
import {
  WARNING_LIMITS,
  WARNING_THRESHOLD_ACTIONS,
} from "@/lib/moderation/warnings";

export const thresholdBody = z
  .object({
    points: z.number().int().min(1).max(WARNING_LIMITS.maxThresholdPoints),
    action: z.enum(WARNING_THRESHOLD_ACTIONS),
    durationMinutes: z
      .number()
      .int()
      .min(1)
      .max(WARNING_LIMITS.maxDurationMinutes)
      .nullable(),
    enabled: z.boolean(),
  })
  .refine(
    value =>
      value.action === "suspend_temporary"
        ? value.durationMinutes !== null
        : value.durationMinutes === null,
    { message: "duration_mismatch", path: ["durationMinutes"] },
  );

export const idParams = z.object({
  id: z.coerce.number().int().positive().openapi({ example: 1 }),
});

export const responses = {
  400: json(errorSchema, "A temporary suspension needs a duration"),
  403: { description: "Access Denied" },
  409: json(
    errorSchema,
    "Another enabled threshold uses the same points, or the limit is reached",
  ),
};
