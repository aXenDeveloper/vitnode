import type { Context } from "hono";

import { randomUUID } from "node:crypto";

/**
 * A safety net, not the freshness mechanism: every write that can move a count
 * moves the generation (see `./events.ts`), so this only bounds how long a
 * change that slipped past the listeners - a row edited in SQL, a scheduled
 * `publishedAt` coming due - can stay invisible.
 */
export const FORUM_STATS_CACHE_TTL_SECONDS = 300;

// In the system namespace because the listeners that move it run on whichever
// context emitted the event - a core approvals or moderation route has no forum
// plugin on it, and a plugin-scoped key would be a different key there.
const GENERATION_KEY = "@vitnode/forum:stats:generation";

const readGeneration = async (c: Context): Promise<string> =>
  (await c.get("cache").getSystem<string>(GENERATION_KEY)) ?? "0";

/**
 * `loader`'s result, cached for the current stats generation.
 *
 * A no-op without Redis, like every other cache read: the loader just runs.
 */
export const rememberForumStats = async <T>(
  c: Context,
  key: string,
  loader: () => Promise<T>,
): Promise<T> =>
  await c
    .get("cache")
    .remember(
      `stats:v1:${await readGeneration(c)}:${key}`,
      FORUM_STATS_CACHE_TTL_SECONDS,
      loader,
    );

/**
 * Expires every cached forum and topic stat at once.
 *
 * A single write rather than a key scan: one new comment changes its topic's
 * row, its forum's row and every cached topic page that lists it, which is
 * more keys than are worth finding. The orphaned entries fall out on their TTL.
 * The stamp is random rather than a timestamp so skewed clocks between
 * instances can never point reads back at an older generation.
 */
export const invalidateForumStats = async (c: Context): Promise<void> => {
  await c.get("cache").setSystem(GENERATION_KEY, randomUUID());
};
