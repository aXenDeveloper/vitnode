import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/builders";
import { REACTIONS_LIMITS } from "@/lib/reactions/const";
import { readReactionSummaries } from "@/lib/reactions/service";

import { parseReactionIds, reactionTargetOf } from "../lib/target";
import { json, reactionSummarySchema, targetFields } from "../reactions.schema";

export const reactionsSummariesRoute = buildRoute({
  route: {
    method: "get",
    path: "/",
    description:
      "Reactions of up to 100 targets of one type: counts per reaction, the viewer's own reactions and whether they can react. An unreadable or unknown target answers like one nobody reacted to",
    request: {
      query: z.object({
        ...targetFields,
        ids: z.string().min(1).max(4000).openapi({ example: "12,13,14" }),
      }),
    },
    responses: {
      200: json(
        z.object({ items: z.array(reactionSummarySchema) }),
        "Reaction summaries, in the order asked",
      ),
    },
  },
  handler: async c => {
    const query = c.req.valid("query");
    const registered = reactionTargetOf(c, query);
    c.header("Cache-Control", "private, no-store");
    if (!registered) {
      return c.json(
        {
          items: query.ids
            .split(",")
            .slice(0, REACTIONS_LIMITS.idsPerRequest)
            .map(id => ({
              canReact: false,
              counts: [],
              id: id.trim(),
              seq: 0,
              total: 0,
              viewer: [],
            })),
        },
        200,
      );
    }

    const ids = parseReactionIds(
      registered,
      query.ids,
      REACTIONS_LIMITS.idsPerRequest,
    );

    return c.json(
      { items: await readReactionSummaries(c, registered, ids) },
      200,
    );
  },
});
