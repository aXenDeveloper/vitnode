import type { z } from "@hono/zod-openapi";

import type { reasonBody } from "../warning-reasons.schema";

export const auditedSettings = (body: Partial<z.infer<typeof reasonBody>>) => ({
  enabled: body.enabled,
  expiresAfterHours: body.expiresAfterHours,
  points: body.points,
});
