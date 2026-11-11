import type { z } from "@hono/zod-openapi";

import {
  conflictSchema,
  errorSchema,
  json,
  reportStateSchema,
} from "./moderation.schema";

export const mutationResponses = {
  200: json(reportStateSchema, "The report's new state"),
  400: { description: "Invalid input" },
  401: { description: "Sign in first" },
  403: json(errorSchema, "The moderator may not manage this report"),
  404: json(errorSchema, "No such report, or not one this moderator may see"),
  409: json(
    conflictSchema,
    "The report changed since it was read, or is in the wrong state",
  ),
};

export const body = <T extends z.ZodType>(schema: T) => ({
  body: { content: { "application/json": { schema } } },
});
