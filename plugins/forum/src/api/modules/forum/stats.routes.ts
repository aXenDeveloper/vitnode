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
import { replyContent } from "@/database/replies";
import { topicContent } from "@/database/topics";

export const FORUM_STATS_MAX_TOPICS = 50;

const topicColumns = topicContent.columns as Record<string, PgColumn>;
const replyColumns = replyContent.columns as Record<string, PgColumn>;

const publicTopic = () =>
  publishedCondition(publicationColumns(topicContent.definition, topicColumns));

const publicReply = () =>
  publishedCondition(publicationColumns(replyContent.definition, replyColumns));

const iso = (value: Date | null | string | undefined): null | string =>
  value === null || value === undefined ? null : new Date(value).toISOString();

const statsTags = (): string[] => [
  contentPublicListTag(topicContent.definition.id),
  contentPublicListTag(replyContent.definition.id),
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
      "Public topic and reply counts per forum, with each forum's newest public topic",
    responses: {
      200: json(
        z.object({
          items: z.array(
            z.object({
              forumId: z.number(),
              latestTopic: zodLatestTopic.nullable(),
              replyCount: z.number(),
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
    const replies = replyContent.table;

    const [topicCounts, replyCounts, latest] = await Promise.all([
      db
        .select({ forumId: topics.forum, value: count() })
        .from(topics)
        .where(publicTopic())
        .groupBy(topics.forum),
      db
        .select({ forumId: topics.forum, value: count() })
        .from(replies)
        .innerJoin(topics, eq(replies.topic, topics.id))
        .where(and(publicReply(), publicTopic()))
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

    const replyCountOf = new Map(
      replyCounts.map(row => [row.forumId, row.value]),
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
            replyCount: replyCountOf.get(row.forumId) ?? 0,
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
    description: `Public reply count and last public reply time for up to ${FORUM_STATS_MAX_TOPICS} topics`,
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
              lastReplyAt: z.string().nullable(),
              replyCount: z.number(),
              topicId: z.number(),
            }),
          ),
        }),
        "Stats for the requested topics that have public replies",
      ),
      400: { description: "`ids` is not a list of up to 50 topic ids" },
    },
  },
  handler: async c => {
    const ids = [
      ...new Set(c.req.valid("query").ids.split(",").map(Number)),
    ].filter(id => Number.isSafeInteger(id));
    const replies = replyContent.table;
    const topics = topicContent.table;

    const rows =
      ids.length === 0
        ? []
        : await c
            .get("db")
            .select({
              lastReplyAt: max(replies.publishedAt),
              topicId: replies.topic,
              value: count(),
            })
            .from(replies)
            .innerJoin(topics, eq(replies.topic, topics.id))
            .where(
              and(inArray(replies.topic, ids), publicReply(), publicTopic()),
            )
            .groupBy(replies.topic);

    setPageCacheTags(c, statsTags());

    return c.json(
      {
        items: rows.map(row => ({
          lastReplyAt: iso(row.lastReplyAt),
          replyCount: row.value,
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
    description: "The public slug of one topic, for building a reply permalink",
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
