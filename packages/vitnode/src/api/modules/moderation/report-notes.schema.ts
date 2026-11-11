import { z } from "@hono/zod-openapi";

import { errorSchema, json, reportIdParams } from "./moderation.schema";

export const noteParams = reportIdParams.extend({
  noteId: z.coerce.number().int().positive().openapi({ example: 1 }),
});

export const noteResponses = {
  200: json(z.object({ ok: z.boolean() }), "Done"),
  400: { description: "Invalid input" },
  401: { description: "Sign in first" },
  403: json(
    errorSchema,
    "Not the note's author, and no permission for others' notes",
  ),
  404: json(
    errorSchema,
    "No such report or note, or not one this moderator may see",
  ),
};
