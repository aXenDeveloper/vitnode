import type { PgColumn } from "drizzle-orm/pg-core";

import { z } from "@hono/zod-openapi";
import { setPageCacheTags } from "@vitnode/core/api/lib/page-cache";
import { buildRoute } from "@vitnode/core/api/lib/route";
import {
  contentContainerTag,
  contentPublicListTag,
} from "@vitnode/core/content";
import {
  publicationColumns,
  publishedCondition,
} from "@vitnode/core/content/server";
import { and, count, desc, eq, inArray, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { CONFIG_PLUGIN } from "@/const";
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

const iso = (value: Date | null | string | undefined): null | string =>
  value === null || value === undefined ? null : new Date(value).toISOString();

const statsTags = (): string[] => [
  contentPublicListTag(topicContent.definition.id),
  contentPublicListTag(commentContent.definition.id),
  contentContainerTag(forumContainers.id),
];

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
  pluginId: CONFIG_PLUGIN.pluginId,
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

    const commentCountOf = new Map(
      commentCounts.map(row => [row.forumId, row.value]),
    );
    const latestOf = new Map(latest.map(row => [row.forumId, row]));

    setPageCacheTags(c, statsTags());

    return c.json(
      {
        items: topicCounts.map(row => {
          const newest = latestOf.get(row.forumId);

          return {
            forumId: row.forumId,
            latestTopic: newest
              ? {
                  id: newest.id,
                  publishedAt: iso(newest.publishedAt),
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
    );
  },
});

const TOPIC_IDS = new RegExp(
  `^[1-9]\\d{0,15}(,[1-9]\\d{0,15}){0,${FORUM_STATS_MAX_TOPICS - 1}}$`,
);

export const topicStatsRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
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
    const ids = [
      ...new Set(c.req.valid("query").ids.split(",").map(Number)),
    ].filter(id => Number.isSafeInteger(id));
    const comments = commentContent.table;
    const topics = topicContent.table;

    const rows =
      ids.length === 0
        ? []
        : await c
            .get("db")
            .select({
              lastCommentAt: max(comments.publishedAt),
              topicId: comments.topic,
              value: count(),
            })
            .from(comments)
            .innerJoin(topics, eq(comments.topic, topics.id))
            .where(
              and(inArray(comments.topic, ids), publicComment(), publicTopic()),
            )
            .groupBy(comments.topic);

    setPageCacheTags(c, statsTags());

    return c.json(
      {
        items: rows.map(row => ({
          lastCommentAt: iso(row.lastCommentAt),
          commentCount: row.value,
          topicId: row.topicId,
        })),
      },
      200,
    );
  },
});

export const topicSlugRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
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

    const [row] = await c
      .get("db")
      .select({ id: topics.id, slug: topics.slug })
      .from(topics)
      .where(and(eq(topics.id, id), publicTopic()))
      .limit(1);

    if (!row) throw new HTTPException(404, { message: "Topic not found." });

    setPageCacheTags(c, [contentPublicListTag(topicContent.definition.id)]);

    return c.json({ id: row.id, slug: row.slug }, 200);
  },
});
