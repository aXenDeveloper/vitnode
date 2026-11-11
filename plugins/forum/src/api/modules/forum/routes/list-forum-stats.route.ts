import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { createContentAccess } from "@vitnode/core/content/server";
import { and, count, desc, eq } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import {
  forumStatsCache,
  readForumStatsGeneration,
} from "@/api/lib/stats-cache";
import { forumContainers } from "@/content/forums";
import { commentContent } from "@/database/comments";
import { topicContent } from "@/database/topics";

import { json } from "../lib/json-response";
import { publicComment, publicTopic } from "../lib/public-condition";
import { forumStatsHeaders, iso } from "../lib/stats";

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
    const { commentCounts, latest, topicCounts } = await c
      .get("cache")
      .entry(forumStatsCache, await readForumStatsGeneration(c))
      .remember(async () => {
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
      });

    const commentCountOf = new Map(
      commentCounts.map(row => [row.forumId, row.value]),
    );
    const latestOf = new Map(latest.map(row => [row.forumId, row]));
    const [readable, headers] = await Promise.all([
      readableForumIds(c),
      forumStatsHeaders(c),
    ]);

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
