import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { createContentAccess } from "@vitnode/core/content/server";
import { and, inArray } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { topicContent } from "@/database/topics";

import { json } from "../lib/json-response";
import { forumStatsHeaders, loadTopicStats } from "../lib/stats";

export const FORUM_STATS_MAX_TOPICS = 50;

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
    const [items, headers] = await Promise.all([
      readableTopicIds(c, ids).then(
        async readable => await loadTopicStats(c, readable),
      ),
      forumStatsHeaders(c),
    ]);

    return c.json({ items }, 200, headers);
  },
});
