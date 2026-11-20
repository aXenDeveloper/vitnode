import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/builders";
import { ReactionWriteError, removeReaction } from "@/lib/reactions/service";

import { reactionTargetOf } from "../lib/target";
import {
  json,
  reactionErrorSchema,
  reactionSummarySchema,
  targetFields,
} from "../reactions.schema";

export const unreactRoute = buildRoute({
  route: {
    method: "delete",
    path: "/",
    description:
      "Remove the signed-in member's reaction from one target, or every one of theirs without `reaction`. Never limited. Idempotent",
    request: {
      query: z.object({
        ...targetFields,
        id: z.string().min(1).max(64),
        reaction: z.string().min(1).max(32).optional(),
      }),
    },
    responses: {
      200: json(
        reactionSummarySchema,
        "The target's reactions after the write",
      ),
      401: json(reactionErrorSchema, "Sign in first (`sign_in`)"),
      404: json(
        reactionErrorSchema,
        "Unknown target type or reaction, bad id, or a target the member cannot read",
      ),
    },
  },
  handler: async c => {
    const query = c.req.valid("query");
    const registered = reactionTargetOf(c, query);
    const id = registered?.definition.parseId(query.id) ?? null;
    if (!registered || id === null) {
      return c.json({ error: "not_found" }, 404);
    }

    try {
      const summary = await removeReaction(c, registered, {
        code: query.reaction,
        id,
      });

      return c.json(summary, 200);
    } catch (error) {
      if (!(error instanceof ReactionWriteError)) throw error;
      if (error.status === 401) return c.json({ error: error.code }, 401);

      return c.json({ error: error.code }, 404);
    }
  },
});
