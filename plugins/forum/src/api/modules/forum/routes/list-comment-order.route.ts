import type { PgColumn } from "drizzle-orm/pg-core";

import { z } from "@hono/zod-openapi";
import { CONTENT_PUBLIC_MAX_PAGE_SIZE } from "@vitnode/api/content";
import {
  and,
  asc,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  lte,
  sql,
} from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import { commentContentType } from "@/content/comment";
import { commentContent } from "@/database/comments";
import { topicContent } from "@/database/topics";

import { json } from "../lib/json-response";
import { reactionPointsSubquery } from "../lib/reaction-points";

/**
 * Top-level comments a reader can find in the thread: published, not hidden.
 * Deleted ones stay in - the thread keeps them as "removed" placeholders while
 * they have replies, and drops the rest itself.
 */
const rootCondition = (topicId: number) => {
  const columns = commentContent.columns as Record<string, PgColumn>;
  const comments = commentContent.table;

  return and(
    eq(comments.topic, topicId),
    isNull(comments.parent),
    eq(columns.status, "published"),
    isNotNull(columns.publishedAt),
    lte(columns.publishedAt, sql`now()`),
    isNull(columns.hiddenAt),
  );
};

/**
 * The ids of one page of a topic's top-level comments, newest first or by
 * points from reactions. The thread's own `/thread` route reads the default
 * posting order; this one only decides the order - the browser reads the
 * branches themselves through `/content/comments/thread/branches`, which
 * applies every visibility rule again.
 */
export const commentOrderRoute = buildRoute({
  route: {
    method: "get",
    path: "/topics/{id}/comments/order",
    description:
      "The ids of one page of a topic's top-level comments, newest first or with the most points from reactions first",
    request: {
      params: z.object({
        id: z.coerce.number().int().positive().openapi({ example: 1 }),
      }),
      query: z.object({
        after: z.coerce
          .number()
          .int()
          .min(0)
          .max(100_000)
          .default(0)
          .openapi({ description: "How many top-level comments to skip." }),
        first: z.coerce
          .number()
          .int()
          .min(1)
          .max(CONTENT_PUBLIC_MAX_PAGE_SIZE)
          .default(20),
        sort: z.enum(["new", "points"]),
      }),
    },
    responses: {
      200: json(
        z.object({
          ids: z.array(z.number()),
          pageInfo: z.object({
            endCursor: z.string().nullable(),
            hasNextPage: z.boolean(),
            totalCount: z.number(),
          }),
        }),
        "Top-level comment ids in order",
      ),
      404: { description: "No topic the viewer may read" },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const { after, first, sort } = c.req.valid("query");

    // The public service applies publication and the forum's access rules.
    const topic = await topicContent.publicService?.(c).findById(id);
    if (!topic) throw new HTTPException(404, { message: "Topic not found." });

    const db = c.get("db");
    const comments = commentContent.table;
    const columns = commentContent.columns as Record<string, PgColumn>;
    const where = rootCondition(id);

    const reactionPoints = reactionPointsSubquery(
      c,
      commentContentType.id,
      "forum_comment_reaction_points",
    );
    const points = sql<number>`coalesce(${reactionPoints.points}, 0)`;

    const [rows, [total]] = await Promise.all([
      db
        .select({ id: comments.id })
        .from(comments)
        .leftJoin(
          reactionPoints,
          eq(reactionPoints.targetId, sql`cast(${comments.id} as varchar)`),
        )
        .where(where)
        .orderBy(
          ...(sort === "points"
            ? [desc(points), asc(columns.publishedAt), asc(comments.id)]
            : [desc(columns.publishedAt), desc(comments.id)]),
        )
        .limit(first + 1)
        .offset(after),
      db.select({ value: count() }).from(comments).where(where),
    ]);

    const hasNextPage = rows.length > first;

    return c.json(
      {
        ids: rows.slice(0, first).map(row => row.id),
        pageInfo: {
          endCursor: hasNextPage ? String(after + first) : null,
          hasNextPage,
          totalCount: total?.value ?? 0,
        },
      },
      200,
      // Reactions move the order without expiring any cache tag.
      { "Cache-Control": "private, no-store" },
    );
  },
});
