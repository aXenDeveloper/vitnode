import type { Context } from "hono";

import {
  core_reactions,
  core_reactions_counts,
} from "@vitnode/api/database/reactions";
import { and, eq, sql } from "drizzle-orm";

import { manifest } from "@/manifest.gen";

/**
 * Points per target of one forum content type: each reaction's count times
 * its points, as set in AdminCP → Reactions - exactly what the reaction pills
 * under the item add up to, so the number a reader sees and the one the feed
 * ranks by never disagree. Disabled reactions are left out, as the pills leave
 * them out. Read from the denormalized counts.
 */
export const reactionPointsSubquery = (
  c: Context,
  targetType: string,
  alias: string,
) =>
  c
    .get("db")
    .select({
      points:
        sql<number>`coalesce(sum(${core_reactions_counts.count} * ${core_reactions.points}), 0)::int`.as(
          "points",
        ),
      targetId: core_reactions_counts.targetId,
    })
    .from(core_reactions_counts)
    .innerJoin(
      core_reactions,
      eq(core_reactions_counts.reactionId, core_reactions.id),
    )
    .where(
      and(
        eq(core_reactions_counts.pluginId, manifest.id),
        eq(core_reactions_counts.targetType, targetType),
        eq(core_reactions.enabled, true),
      ),
    )
    .groupBy(core_reactions_counts.targetId)
    .as(alias);
