import type { PgColumn } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { setPageCacheTags } from "@vitnode/core/api/lib/page-cache";
import {
  contentAccessTag,
  contentContainerTag,
  contentPublicListTag,
} from "@vitnode/core/content";
import {
  createContentAccess,
  publicationColumns,
  publishedCondition,
} from "@vitnode/core/content/server";
import { and, count, desc, eq, inArray, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { createHash } from "node:crypto";

import { buildRoute } from "@/api/builders";
import { rememberForumStats } from "@/api/lib/stats-cache";
import { forumContainers } from "@/content/forums";
import { commentContent } from "@/database/comments";
import { topicContent } from "@/database/topics";

export const FORUM_STATS_MAX_TOPICS = 50;

const topicColumns = topicContent.columns as Record<string, PgColumn>;
const commentColumns = commentContent.columns as Record<string, PgColumn>;

const publicTopic = () =>
  publishedCondition(publicationColumns(topicContent.definition, topicColumns));

const publicComment = () =>
  publishedCondition(
    publicationColumns(commentContent.definition, commentColumns),
  );

export const iso = (value: Date | null | string | undefined): null | string =>
  value === null || value === undefined ? null : new Date(value).toISOString();

const statsTags = (): string[] => [
  contentPublicListTag(topicContent.definition.id),
  contentPublicListTag(commentContent.definition.id),
  contentContainerTag(forumContainers.id),
  contentAccessTag(forumContainers.id),
];

/**
 * The forums whose topics the viewer may read, or `null` for all of them.
 * The cached stats are everybody's; each response keeps only these rows, so a
 * restricted forum's counts and newest title never reach anyone else.
 */
export const readableForumIds = async (
  c: Context,
): Promise<null | Set<number>> => {
  const allowed = await createContentAccess(c).allowedScopes(
    forumContainers.id,
    "read",
  );

  return allowed.all ? null : new Set(allowed.ids.map(Number));
};

/**
 * The headers of a stats response: shared (and page-cache tagged) only when
 * no access rule can change it, `private, no-store` otherwise.
 */
export const forumStatsHeaders = async (
  c: Context,
): Promise<Record<string, string>> => {
  if (!(await createContentAccess(c).isOpen(topicContent))) {
    return { "Cache-Control": "private, no-store" };
  }

  setPageCacheTags(c, statsTags());

  return {};
};

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});

const zodLatestTopic = z.object({
  id: z.number(),
  publishedAt: z.string().nullable(),
  slug: z.string(),
  title: z.string(),
});

export const forumStatsRoute = buildRoute({
  route: {
    method: "get",
    path: "/stats/forums",
    description:
      "Public topic and comment counts per forum, with each forum's newest public topic",
    responses: {
      200: json(
        z.object({
          items: z.array(
            z.object({
              forumId: z.number(),
              latestTopic: zodLatestTopic.nullable(),
              commentCount: z.number(),
              topicCount: z.number(),
            }),
          ),
        }),
        "Stats for every forum with at least one public topic",
      ),
    },
  },
  handler: async c => {
    const db = c.get("db");
    const topics = topicContent.table;
    const comments = commentContent.table;

    // Three whole-table aggregates, read by every forum index visit - cached
    // until a forum write moves the generation.
    const { commentCounts, latest, topicCounts } = await rememberForumStats(
      c,
      "forums",
      async () => {
        const [topicCounts, commentCounts, latest] = await Promise.all([
          db
            .select({ forumId: topics.forum, value: count() })
            .from(topics)
            .where(publicTopic())
            .groupBy(topics.forum),
          db
            .select({ forumId: topics.forum, value: count() })
            .from(comments)
            .innerJoin(topics, eq(comments.topic, topics.id))
            .where(and(publicComment(), publicTopic()))
            .groupBy(topics.forum),
          db
            .selectDistinctOn([topics.forum], {
              forumId: topics.forum,
              id: topics.id,
              publishedAt: topics.publishedAt,
              slug: topics.slug,
              title: topics.title,
            })
            .from(topics)
            .where(publicTopic())
            .orderBy(topics.forum, desc(topics.publishedAt), desc(topics.id)),
        ]);

        // Dates are serialized here so a cache hit and a miss hand the
        // mapper below the same shape.
        return {
          commentCounts,
          latest: latest.map(row => ({
            ...row,
            publishedAt: iso(row.publishedAt),
          })),
          topicCounts,
        };
      },
    );

    const commentCountOf = new Map(
      commentCounts.map(row => [row.forumId, row.value]),
    );
    const latestOf = new Map(latest.map(row => [row.forumId, row]));
    const readable = await readableForumIds(c);

    const headers = await forumStatsHeaders(c);

    return c.json(
      {
        items: topicCounts
          .filter(row => !readable || readable.has(row.forumId))
          .map(row => {
          const newest = latestOf.get(row.forumId);

          return {
            forumId: row.forumId,
            latestTopic: newest
              ? {
                  id: newest.id,
                  publishedAt: newest.publishedAt,
                  slug: newest.slug,
                  title: newest.title,
                }
              : null,
            commentCount: commentCountOf.get(row.forumId) ?? 0,
            topicCount: row.value,
          };
        }),
      },
      200,
      headers,
    );
  },
});

interface TopicStatsItem {
  commentCount: number;
  lastCommentAt: null | string;
  topicId: number;
}

/**
 * Public comment count and last public comment time for each of `ids` that has
 * any, cached per id set: a forum page asks for the same page of topics far
 * more often than any of them gains a comment.
 */
export const loadTopicStats = async (
  c: Context,
  ids: readonly number[],
): Promise<TopicStatsItem[]> => {
  const unique = [...new Set(ids)]
    .filter(id => Number.isSafeInteger(id))
    .toSorted((a, b) => a - b);
  if (unique.length === 0) return [];

  const comments = commentContent.table;
  const topics = topicContent.table;
  const key = createHash("sha256").update(unique.join(",")).digest("base64url");

  return await rememberForumStats(c, `topics:${key}`, async () => {
    const rows = await c
      .get("db")
      .select({
        lastCommentAt: max(comments.publishedAt),
        topicId: comments.topic,
        value: count(),
      })
      .from(comments)
      .innerJoin(topics, eq(comments.topic, topics.id))
      .where(
        and(inArray(comments.topic, unique), publicComment(), publicTopic()),
      )
      .groupBy(comments.topic);

    return rows.map(row => ({
      lastCommentAt: iso(row.lastCommentAt),
      commentCount: row.value,
      topicId: row.topicId,
    }));
  });
};

/** The topics among `ids` the viewer may read, by their forum's rules now. */
export const readableTopicIds = async (
  c: Context,
  ids: readonly number[],
): Promise<number[]> => {
  const unique = [...new Set(ids)].filter(id => Number.isSafeInteger(id));
  if (unique.length === 0) return [];
  const condition = await createContentAccess(c).condition(
    topicContent,
    "read",
  );
  if (!condition) return unique;

  const topics = topicContent.table;
  const rows = await c
    .get("db")
    .select({ id: topics.id })
    .from(topics)
    .where(and(inArray(topics.id, unique), condition));

  return rows.map(row => row.id);
};

const TOPIC_IDS = new RegExp(
  `^[1-9]\\d{0,15}(,[1-9]\\d{0,15}){0,${FORUM_STATS_MAX_TOPICS - 1}}$`,
);

export const topicStatsRoute = buildRoute({
  route: {
    method: "get",
    path: "/stats/topics",
    description: `Public comment count and last public comment time for up to ${FORUM_STATS_MAX_TOPICS} topics`,
    request: {
      query: z.object({
        ids: z.string().regex(TOPIC_IDS).openapi({ example: "1,2,3" }),
      }),
    },
    responses: {
      200: json(
        z.object({
          items: z.array(
            z.object({
              lastCommentAt: z.string().nullable(),
              commentCount: z.number(),
              topicId: z.number(),
            }),
          ),
        }),
        "Stats for the requested topics that have public comments",
      ),
      400: { description: "`ids` is not a list of up to 50 topic ids" },
    },
  },
  handler: async c => {
    const ids = c.req.valid("query").ids.split(",").map(Number);
    const items = await loadTopicStats(c, await readableTopicIds(c, ids));

    const headers = await forumStatsHeaders(c);

    return c.json({ items }, 200, headers);
  },
});

export const topicSlugRoute = buildRoute({
  route: {
    method: "get",
    path: "/topics/{id}/slug",
    description:
      "The public slug of one topic, for building a comment permalink",
    request: {
      params: z.object({
        id: z.coerce.number().int().positive().openapi({ example: 1 }),
      }),
    },
    responses: {
      200: json(
        z.object({ id: z.number(), slug: z.string() }),
        "The topic's slug",
      ),
      404: { description: "No public topic with this id" },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const topics = topicContent.table;

    const access = createContentAccess(c);
    const [row] = await c
      .get("db")
      .select({ id: topics.id, slug: topics.slug })
      .from(topics)
      .where(
        and(
          eq(topics.id, id),
          publicTopic(),
          await access.condition(topicContent, "read"),
        ),
      )
      .limit(1);

    if (!row) throw new HTTPException(404, { message: "Topic not found." });

    if (!(await access.isOpen(topicContent))) {
      return c.json({ id: row.id, slug: row.slug }, 200, {
        "Cache-Control": "private, no-store",
      });
    }

    setPageCacheTags(c, [contentPublicListTag(topicContent.definition.id)]);

    return c.json({ id: row.id, slug: row.slug }, 200);
  },
});
