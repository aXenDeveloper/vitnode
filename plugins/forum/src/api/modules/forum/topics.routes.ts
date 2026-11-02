import { z } from "@hono/zod-openapi";
import {
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@vitnode/core/api/lib/with-pagination";
import {
  CONTENT_ACCESS_REQUIRED_CODE,
  zodContentPublicPerson,
} from "@vitnode/core/content";
import { createContentAccess } from "@vitnode/core/content/server";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import { forumContainers } from "@/content/forums";
import { topicContent } from "@/database/topics";

import { forumStatsHeaders, iso, loadTopicStats } from "./stats.routes";

/**
 * One page of a forum's topics with their comment stats, for the forum page.
 *
 * The page itself is read through the Content Engine's own public service -
 * the same published-and-not-hidden predicate, ordering and cursor format as
 * `GET /content/topics` - so a cursor from either route works on the other and
 * this route cannot drift into showing a topic that one would hide. The stats
 * for the page come in the same request, not a follow-up call that waits for
 * the ids.
 */
export const forumTopicsRoute = buildRoute({
  route: {
    method: "get",
    path: "/topics",
    description:
      "One page of a forum's public topics, without bodies, each with its public comment count and last comment time",
    request: {
      query: zodPaginationQuery.extend({
        forumId: z.coerce.number().int().positive().openapi({ example: 1 }),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              edges: z.array(
                z.object({
                  author: zodContentPublicPerson.nullable(),
                  commentCount: z.number(),
                  forum: z.number(),
                  id: z.number(),
                  lastCommentAt: z.string().nullable(),
                  publishedAt: z.string().nullable(),
                  slug: z.string(),
                  title: z.string(),
                }),
              ),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: "A page of topics, newest first",
      },
      400: { description: "Invalid query parameters" },
      403: {
        content: {
          "application/json": {
            schema: z.object({
              accessRequired: z.literal(true),
              code: z.literal(CONTENT_ACCESS_REQUIRED_CODE),
            }),
          },
        },
        description: "The viewer may see the forum but not read its topics",
      },
      404: { description: "No forum the viewer may see" },
    },
  },
  handler: async c => {
    const { cursor, first, forumId, last, page } = c.req.valid("query");
    const service = topicContent.publicService?.(c);
    if (!service) {
      throw new HTTPException(500, { message: "Topics have no public API." });
    }

    // A forum the viewer may not see is not found; one they may see but not
    // read says so, without listing anything in it.
    const access = createContentAccess(c);
    if (!(await access.canScope(forumContainers.id, forumId, "view"))) {
      throw new HTTPException(404, { message: "Forum not found." });
    }
    if (!(await access.canScope(forumContainers.id, forumId, "read"))) {
      return c.json(
        { accessRequired: true as const, code: CONTENT_ACCESS_REQUIRED_CODE },
        403,
        { "Cache-Control": "private, no-store" },
      );
    }

    const { edges, pageInfo } = await service.findMany({
      filters: { forum: forumId },
      query: { cursor, first, last, page },
    });
    const stats = new Map(
      (
        await loadTopicStats(
          c,
          edges.map(edge => edge.id),
        )
      ).map(item => [item.topicId, item]),
    );

    const headers = await forumStatsHeaders(c);

    return c.json(
      {
        edges: edges.map(edge => {
          const stat = stats.get(edge.id);

          return {
            author: edge.author,
            commentCount: stat?.commentCount ?? 0,
            forum: edge.forum,
            id: edge.id,
            lastCommentAt: stat?.lastCommentAt ?? null,
            publishedAt: iso(edge.publishedAt),
            slug: edge.slug,
            title: edge.title,
          };
        }),
        pageInfo,
      },
      200,
      headers,
    );
  },
});
