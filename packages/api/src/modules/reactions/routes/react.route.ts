import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/builders";
import { addReaction, ReactionWriteError } from "@/lib/reactions/service";

import { reactionTargetOf } from "../lib/target";
import {
  json,
  reactionErrorSchema,
  reactionSummarySchema,
  targetFields,
} from "../reactions.schema";

export const reactRoute = buildRoute({
  route: {
    method: "put",
    path: "/",
    description:
      "Add the signed-in member's reaction to one target. When their roles allow one reaction per item, it replaces the previous one. Idempotent",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              ...targetFields,
              id: z.string().min(1).max(64),
              reaction: z.string().min(1).max(32),
            }),
          },
        },
      },
    },
    responses: {
      200: json(
        reactionSummarySchema,
        "The target's reactions after the write",
      ),
      401: json(reactionErrorSchema, "Sign in first (`sign_in`)"),
      403: json(
        reactionErrorSchema,
        "No role allows reacting (`reacting_disabled`), this reaction (`reaction_not_allowed`), reacting to your own content (`self_reaction`) or to a locked target (`locked`)",
      ),
      404: json(
        reactionErrorSchema,
        "Unknown target type, bad id, a disabled reaction, or a target the member cannot read",
      ),
      409: json(
        reactionErrorSchema,
        "The member already gave as many reactions to this item as their roles allow (`item_limit`)",
      ),
      429: json(
        reactionErrorSchema,
        "A daily limit is used up: all reactions (`daily_limit`) or this one (`reaction_daily_limit`)",
      ),
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    const registered = reactionTargetOf(c, body);
    const id = registered?.definition.parseId(body.id) ?? null;
    if (!registered || id === null) {
      return c.json({ error: "not_found" }, 404);
    }

    try {
      const summary = await addReaction(c, registered, {
        code: body.reaction,
        id,
      });

      return c.json(summary, 200);
    } catch (error) {
      if (!(error instanceof ReactionWriteError)) throw error;
      const payload = {
        error: error.code,
        resetsAt: error.resetsAt?.toISOString() ?? null,
      };
      switch (error.status) {
        case 401:
          return c.json(payload, 401);
        case 403:
          return c.json(payload, 403);
        case 409:
          return c.json(payload, 409);
        case 429:
          return c.json(payload, 429);
        default:
          return c.json(payload, 404);
      }
    }
  },
});
