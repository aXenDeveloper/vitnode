import type { Context } from "hono";

import { and, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";

import { core_reactions, core_reactions_entries } from "@/database/reactions";
import { core_users } from "@/database/users";
import { reputationChangedEvent } from "@/events/reactions";

const BATCH = 500;

/** Authors who received reaction `reactionId`, for a recount after it changes. */
export const authorsOfReaction = async (
  c: Context,
  reactionId: number,
): Promise<number[]> => {
  const rows = await c
    .get("db")
    .selectDistinct({ userId: core_reactions_entries.targetAuthorId })
    .from(core_reactions_entries)
    .where(
      and(
        eq(core_reactions_entries.reactionId, reactionId),
        isNotNull(core_reactions_entries.targetAuthorId),
      ),
    );

  return rows.flatMap(row => (row.userId === null ? [] : [row.userId]));
};

/** Everyone whose reputation could be off: anyone with points or who received a reaction. */
const everyoneToRecount = async (c: Context): Promise<number[]> => {
  const rows = await c
    .get("db")
    .select({ id: core_users.id })
    .from(core_users)
    .where(
      or(
        ne(core_users.reputation, 0),
        inArray(
          core_users.id,
          c
            .get("db")
            .selectDistinct({ id: core_reactions_entries.targetAuthorId })
            .from(core_reactions_entries)
            .where(isNotNull(core_reactions_entries.targetAuthorId)),
        ),
      ),
    );

  return rows.map(row => row.id);
};

/**
 * Sets the reputation of `userIds` (everyone, without it) to the sum of the
 * current points of the reactions they received, in batches of 500, and emits
 * `reputation.changed` for every total that moved. Server-only.
 */
export const recountReputation = async (
  c: Context,
  userIds?: readonly number[],
): Promise<number> => {
  const ids = [...new Set(userIds ?? (await everyoneToRecount(c)))];
  let changed = 0;

  for (let index = 0; index < ids.length; index += BATCH) {
    const batch = ids.slice(index, index + BATCH);
    const db = c.get("db");
    const [sums, current] = await Promise.all([
      db
        .select({
          total: sql<number>`coalesce(sum(${core_reactions.points}), 0)::int`,
          userId: core_reactions_entries.targetAuthorId,
        })
        .from(core_reactions_entries)
        .innerJoin(
          core_reactions,
          eq(core_reactions.id, core_reactions_entries.reactionId),
        )
        .where(inArray(core_reactions_entries.targetAuthorId, batch))
        .groupBy(core_reactions_entries.targetAuthorId),
      db
        .select({ id: core_users.id, reputation: core_users.reputation })
        .from(core_users)
        .where(inArray(core_users.id, batch)),
    ]);

    for (const user of current) {
      const total = sums.find(row => row.userId === user.id)?.total ?? 0;
      if (total === user.reputation) continue;

      await db
        .update(core_users)
        .set({ reputation: total })
        .where(eq(core_users.id, user.id));
      await c.get("events").emit(reputationChangedEvent, {
        delta: total - user.reputation,
        reason: "recount",
        total,
        userId: user.id,
      });
      changed++;
    }
  }

  return changed;
};
