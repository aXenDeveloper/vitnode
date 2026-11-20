import { z } from "@hono/zod-openapi";
import { eq, sql } from "drizzle-orm";

import { buildRoute } from "@/builders";
import { core_reactions_entries } from "@/database/reactions";
import { core_users } from "@/database/users";
import { getReactionCatalog } from "@/lib/reactions/catalog";

import { json, reactionPublicSchema } from "../reactions.schema";

export const reputationRoute = buildRoute({
  route: {
    method: "get",
    path: "/reputation/{userId}",
    description:
      "A member's reputation and how many of each reaction their content received",
    request: {
      params: z.object({
        userId: z.coerce.number().int().positive().openapi({ example: 1 }),
      }),
    },
    responses: {
      200: json(
        z.object({
          received: z.array(
            reactionPublicSchema.extend({ count: z.number().int() }),
          ),
          reputation: z.number().int(),
        }),
        "Reputation",
      ),
      404: json(z.object({ error: z.string() }), "User not found"),
    },
  },
  handler: async c => {
    const { userId } = c.req.valid("param");
    const db = c.get("db");
    const [user] = await db
      .select({ reputation: core_users.reputation })
      .from(core_users)
      .where(eq(core_users.id, userId))
      .limit(1);
    if (!user) return c.json({ error: "not_found" }, 404);

    const [counts, catalog] = await Promise.all([
      db
        .select({
          reactionId: core_reactions_entries.reactionId,
          total: sql<number>`count(*)::int`,
        })
        .from(core_reactions_entries)
        .where(eq(core_reactions_entries.targetAuthorId, userId))
        .groupBy(core_reactions_entries.reactionId),
      getReactionCatalog(c),
    ]);

    return c.json(
      {
        received: catalog
          .filter(reaction => reaction.enabled)
          .flatMap(reaction => {
            const count =
              counts.find(row => row.reactionId === reaction.id)?.total ?? 0;

            return count > 0
              ? [
                  {
                    code: reaction.code,
                    count,
                    icon: reaction.icon,
                    image: reaction.image,
                    kind: reaction.kind,
                    points: reaction.points,
                    title: reaction.title,
                  },
                ]
              : [];
          })
          .sort((a, b) => b.count - a.count),
        reputation: user.reputation,
      },
      200,
    );
  },
});
