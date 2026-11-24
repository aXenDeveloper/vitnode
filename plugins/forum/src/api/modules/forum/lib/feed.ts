import type { SQL } from "drizzle-orm";
import type { Context } from "hono";

import { and, count, desc, eq, gte, max, sql } from "drizzle-orm";
import { z } from "zod";

import type { ForumFeedSort, ForumFeedTopWindow } from "@/feed-sorts";

import { defineCacheEntry } from "@/api/builders";
import { readForumStatsGeneration } from "@/api/lib/stats-cache";
import { topicContentType } from "@/content/topic";
import { commentContent } from "@/database/comments";
import { topicContent } from "@/database/topics";
import { FORUM_FEED_MAX_PAGES, FORUM_FEED_PAGE_SIZE } from "@/feed-sorts";

import { publicComment, publicTopic } from "./public-condition";
import { reactionPointsSubquery } from "./reaction-points";
import { iso } from "./stats";

export const FORUM_FEED_MAX_RANKED =
  FORUM_FEED_MAX_PAGES * FORUM_FEED_PAGE_SIZE;

/**
 * Reactions are not forum writes, so they do not move the stats generation.
 * Rankings are cut into one-minute buckets instead: a new reaction (and the
 * `hot` decay) reaches the feed within a minute, a new topic or comment at once.
 */
const FEED_BUCKET_SECONDS = 60;

/** Reddit's hot decay: ten times the engagement is worth 12.5 hours of age. */
const HOT_DECAY_SECONDS = 45_000;

const TOP_WINDOW_INTERVALS: Record<
  Exclude<ForumFeedTopWindow, "all">,
  string
> = {
  day: "1 day",
  week: "7 days",
  month: "1 month",
  year: "1 year",
};

const zodRankedTopic = z.object({
  commentCount: z.number().int(),
  forum: z.number().int(),
  id: z.number().int(),
  lastActivityAt: z.iso.datetime().nullable(),
  points: z.number().int(),
});

export type RankedTopic = z.infer<typeof zodRankedTopic>;

/**
 * Every public topic of one feed in rank order, for everybody: the route keeps
 * only the forums the viewer may read, so a restricted forum's topics never
 * leave the server.
 */
const feedRankingCache = defineCacheEntry({
  name: "feed.ranking",
  version: 2,
  key: (
    generation: string,
    bucket: number,
    sort: ForumFeedSort,
    window: ForumFeedTopWindow,
    forumId: null | number,
  ) => [generation, bucket, sort, window, forumId ?? "all"],
  schema: z.array(zodRankedTopic),
  ttlSeconds: FEED_BUCKET_SECONDS * 2,
});

const rankTopics = async (
  c: Context,
  {
    forumId,
    sort,
    window,
  }: {
    forumId: null | number;
    sort: ForumFeedSort;
    window: ForumFeedTopWindow;
  },
): Promise<RankedTopic[]> => {
  const db = c.get("db");
  const topics = topicContent.table;
  const comments = commentContent.table;

  const commentStats = db
    .select({
      commentCount: count().as("comment_count"),
      lastCommentAt: max(comments.publishedAt).as("last_comment_at"),
      topicId: comments.topic,
    })
    .from(comments)
    .where(publicComment())
    .groupBy(comments.topic)
    .as("forum_feed_comment_stats");

  const reactionPoints = reactionPointsSubquery(
    c,
    topicContentType.id,
    "forum_feed_reaction_points",
  );

  const commentCount = sql<number>`coalesce(${commentStats.commentCount}, 0)::int`;
  const points = sql<number>`coalesce(${reactionPoints.points}, 0)::int`;
  // `greatest` skips nulls: a topic without comments was last active when it
  // was published.
  const lastActivityAt = sql<
    Date | null | string
  >`greatest(${topics.publishedAt}, ${commentStats.lastCommentAt})`;
  const engagement = sql`(${points} + ${commentCount})`;
  const hot = sql`sign(${engagement}) * log(greatest(abs(${engagement}), 1)) + extract(epoch from ${topics.publishedAt}) / ${HOT_DECAY_SECONDS}`;

  const order: SQL[] = {
    active: [desc(lastActivityAt)],
    hot: [desc(hot)],
    new: [desc(topics.publishedAt)],
    top: [desc(points), desc(commentCount), desc(topics.publishedAt)],
  }[sort];

  const rows = await db
    .select({
      commentCount,
      forum: topics.forum,
      id: topics.id,
      lastActivityAt,
      points,
    })
    .from(topics)
    .leftJoin(commentStats, eq(commentStats.topicId, topics.id))
    .leftJoin(
      reactionPoints,
      eq(reactionPoints.targetId, sql`cast(${topics.id} as varchar)`),
    )
    .where(
      and(
        publicTopic(),
        forumId === null ? undefined : eq(topics.forum, forumId),
        sort === "top" && window !== "all"
          ? gte(
              topics.publishedAt,
              sql`now() - cast(${TOP_WINDOW_INTERVALS[window]} as interval)`,
            )
          : undefined,
      ),
    )
    .orderBy(...order, desc(topics.id))
    .limit(FORUM_FEED_MAX_RANKED);

  return rows.map(row => ({
    commentCount: row.commentCount,
    forum: row.forum,
    id: row.id,
    lastActivityAt: iso(row.lastActivityAt),
    points: row.points,
  }));
};

/** The ranked topics of one feed, cached for everybody (see {@link feedRankingCache}). */
export const loadFeedRanking = async (
  c: Context,
  options: {
    forumId: null | number;
    sort: ForumFeedSort;
    window: ForumFeedTopWindow;
  },
): Promise<RankedTopic[]> => {
  const generation = await readForumStatsGeneration(c);
  const bucket = Math.floor(Date.now() / 1000 / FEED_BUCKET_SECONDS);
  // `window` only shapes `top`; folding it away keeps one entry per sort.
  const window = options.sort === "top" ? options.window : "all";

  return await c
    .get("cache")
    .entry(
      feedRankingCache,
      generation,
      bucket,
      options.sort,
      window,
      options.forumId,
    )
    .remember(async () => await rankTopics(c, { ...options, window }));
};
