import type { Context } from "hono";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

import { defineCacheEntry } from "@/api/builders";

/**
 * A safety net, not the freshness mechanism: every write that can move a count
 * moves the generation (see `./events.ts`), so this only bounds how long a
 * change that slipped past the listeners - a row edited in SQL, a scheduled
 * `publishedAt` coming due - can stay invisible.
 */
export const FORUM_STATS_CACHE_TTL_SECONDS = 300;

/**
 * The current stats generation. Stored under the forum plugin whichever
 * context moves it - the listeners also run on core approvals and moderation
 * routes. A missing stamp starts a fresh generation rather than an old one, so
 * losing it costs a cold read, never a stale one.
 */
const forumStatsGenerationCache = defineCacheEntry({
  name: "stats.generation",
  version: 1,
  schema: z.string().min(1),
  ttlSeconds: 24 * 60 * 60,
});

const forumCount = z.object({
  forumId: z.number().int(),
  value: z.number().int(),
});

/** Public topic and comment counts per forum, and each forum's newest topic. */
export const forumStatsCache = defineCacheEntry({
  name: "stats.forums",
  version: 1,
  key: (generation: string) => [generation],
  schema: z.object({
    commentCounts: z.array(forumCount),
    latest: z.array(
      z.object({
        forumId: z.number().int(),
        id: z.number().int(),
        publishedAt: z.iso.datetime().nullable(),
        slug: z.string(),
        title: z.string(),
      }),
    ),
    topicCounts: z.array(forumCount),
  }),
  ttlSeconds: FORUM_STATS_CACHE_TTL_SECONDS,
});

/**
 * Public comment count and last public comment time per topic, for one sorted
 * set of unique topic ids (hashed into the key).
 */
export const topicStatsCache = defineCacheEntry({
  name: "stats.topics",
  version: 1,
  key: (generation: string, topicIds: readonly number[]) => [
    generation,
    createHash("sha256").update(topicIds.join(",")).digest("base64url"),
  ],
  schema: z.array(
    z.object({
      commentCount: z.number().int(),
      lastCommentAt: z.iso.datetime().nullable(),
      topicId: z.number().int(),
    }),
  ),
  ttlSeconds: FORUM_STATS_CACHE_TTL_SECONDS,
});

/** The generation every stats entry is read under. */
export const readForumStatsGeneration = async (c: Context): Promise<string> =>
  await c
    .get("cache")
    .entry(forumStatsGenerationCache)
    .remember(() => randomUUID());

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
  await c.get("cache").entry(forumStatsGenerationCache).set(randomUUID());
};
