import { and, eq, gte, sql } from "drizzle-orm";

import { buildRoute } from "@/builders";
import { core_reactions_entries } from "@/database/reactions";
import { periodContaining } from "@/lib/ai/periods";
import { getReactionCatalog } from "@/lib/reactions/catalog";
import { resolveReactionPolicy } from "@/lib/reactions/policy";
import { isWebSocketEnabled } from "@/ws/registry";

import { json, reactionCatalogSchema } from "../reactions.schema";

const remaining = (limit: null | number, used: number): null | number =>
  limit === null ? null : Math.max(limit - used, 0);

export const reactionsCatalogRoute = buildRoute({
  route: {
    method: "get",
    path: "/catalog",
    description:
      "Enabled reactions in display order, with what the viewer's roles allow: which reactions they may use, how many per item, and what is left of today's limits",
    responses: {
      200: json(reactionCatalogSchema, "The reactions catalog"),
    },
  },
  handler: async c => {
    const catalog = await getReactionCatalog(c);
    const policy = await resolveReactionPolicy(c, catalog);
    const user = c.get("user");
    const day = periodContaining(new Date(), "day", user?.timeZone ?? "UTC");

    const used = user
      ? await c
          .get("db")
          .select({
            reactionId: core_reactions_entries.reactionId,
            total: sql<number>`count(*)::int`,
          })
          .from(core_reactions_entries)
          .where(
            and(
              eq(core_reactions_entries.userId, user.id),
              gte(core_reactions_entries.createdAt, day.start),
            ),
          )
          .groupBy(core_reactions_entries.reactionId)
      : [];
    const usedTotal = used.reduce((sum, row) => sum + row.total, 0);
    const totalLeft = policy.canReact
      ? remaining(policy.totalPerDay, usedTotal)
      : 0;

    c.header("Cache-Control", "private, no-store");

    return c.json(
      {
        items: catalog
          .filter(reaction => reaction.enabled)
          .map(reaction => {
            const limit = policy.reactions.get(reaction.id);
            const own = remaining(
              limit?.dailyLimit ?? null,
              used.find(row => row.reactionId === reaction.id)?.total ?? 0,
            );
            const left =
              own === null
                ? totalLeft
                : totalLeft === null
                  ? own
                  : Math.min(own, totalLeft);

            return {
              code: reaction.code,
              icon: reaction.icon,
              image: reaction.image,
              kind: reaction.kind,
              points: reaction.points,
              remainingToday: limit ? left : 0,
              title: reaction.title,
              usable: limit !== undefined,
            };
          }),
        live: isWebSocketEnabled(),
        maxPerItem: policy.canReact ? policy.maxPerItem : 0,
        remainingToday: totalLeft,
        resetsAt: day.end.toISOString(),
        signedIn: user !== null,
      },
      200,
    );
  },
});
