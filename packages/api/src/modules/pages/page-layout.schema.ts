import { z } from "@hono/zod-openapi";

import { zodContentNode } from "@/blocks/validate";

export const zodZones = z.record(z.string(), z.array(zodContentNode));

const zodLayoutPayload = z.object({
  pageId: z.string(),
  updatedAt: z.string().nullable(),
  zones: zodZones,
});

export const jsonResponse = (description: string) => ({
  content: { "application/json": { schema: zodLayoutPayload } },
  description,
});
