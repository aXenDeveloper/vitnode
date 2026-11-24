import { z } from "@hono/zod-openapi";
import {
  CONTENT_ACCESS_REQUIRED_CODE,
  zodContentPublicPerson,
} from "@vitnode/api/content";
import { richTextToPlainText } from "@vitnode/api/content/rich-text";
import { createContentAccess } from "@vitnode/api/content/server";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import { forumContainers } from "@/content/forums";
import { topicContent } from "@/database/topics";
import {
  FORUM_FEED_DEFAULT_SORT,
  FORUM_FEED_DEFAULT_TOP_WINDOW,
  FORUM_FEED_MAX_PAGES,
  FORUM_FEED_PAGE_SIZE,
  FORUM_FEED_SORTS,
  FORUM_FEED_TOP_WINDOWS,
} from "@/feed-sorts";

import { loadFeedRanking } from "../lib/feed";
import { forumStatsHeaders, iso } from "../lib/stats";
import { readableForumIds } from "./list-forum-stats.route";

const EXCERPT_LENGTH = 280;

const excerptOf = (body: unknown): string => {
  const text = richTextToPlainText(
    body as Parameters<typeof richTextToPlainText>[0],
  )
    .replaceAll(/\s+/g, " ")
    .trim();
  if (text.length <= EXCERPT_LENGTH) return text;

  const cut = text.slice(0, EXCERPT_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");

  return `${(lastSpace > EXCERPT_LENGTH / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

/**
 * One page of a topic feed - every forum the viewer may read, or one forum -
 * ranked `hot`, `new`, `active` or `top`. Each topic comes with a plain-text
 * excerpt of its body, its reaction score and its public comment stats.
 */
export const forumFeedRoute = buildRoute({
  route: {
    method: "get",
    path: "/feed",
    description:
      "One page of public topics across every readable forum, or one forum, ranked hot, new, active or top",
    request: {
      query: z.object({
        forumId: z.coerce.number().int().positive().optional().openapi({
          description: "Only this forum's topics. Omit for every forum.",
          example: 1,
        }),
        page: z.coerce
          .number()
          .int()
          .min(1)
          .max(FORUM_FEED_MAX_PAGES)
          .default(1),
        sort: z.enum(FORUM_FEED_SORTS).default(FORUM_FEED_DEFAULT_SORT),
        t: z
          .enum(FORUM_FEED_TOP_WINDOWS)
          .default(FORUM_FEED_DEFAULT_TOP_WINDOW)
          .openapi({ description: "How far back `top` looks." }),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              items: z.array(
                z.object({
                  author: zodContentPublicPerson.nullable(),
                  commentCount: z.number(),
                  excerpt: z.string(),
                  forum: z.number(),
                  id: z.number(),
                  lastActivityAt: z.string().nullable(),
                  publishedAt: z.string().nullable(),
                  score: z.number(),
                  slug: z.string(),
                  title: z.string(),
                }),
              ),
              pageInfo: z.object({
                hasNextPage: z.boolean(),
                page: z.number(),
              }),
            }),
          },
        },
        description: "A page of ranked topics",
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
    const { forumId, page, sort, t } = c.req.valid("query");
    const service = topicContent.publicService?.(c);
    if (!service?.findManyByIds) {
      throw new HTTPException(500, { message: "Topics have no public API." });
    }

    if (forumId !== undefined) {
      const access = createContentAccess(c);
      if (!(await access.canScope(forumContainers.id, forumId, "view"))) {
        throw new HTTPException(404, { message: "Forum not found." });
      }
      if (!(await access.canScope(forumContainers.id, forumId, "read"))) {
        return c.json(
          {
            accessRequired: true as const,
            code: CONTENT_ACCESS_REQUIRED_CODE,
          },
          403,
          { "Cache-Control": "private, no-store" },
        );
      }
    }

    const [ranked, readable, headers] = await Promise.all([
      loadFeedRanking(c, { forumId: forumId ?? null, sort, window: t }),
      readableForumIds(c),
      forumStatsHeaders(c),
    ]);
    const visible = readable
      ? ranked.filter(item => readable.has(item.forum))
      : ranked;
    const start = (page - 1) * FORUM_FEED_PAGE_SIZE;
    const slice = visible.slice(start, start + FORUM_FEED_PAGE_SIZE);

    // The ranking is a minute old at most; the rows are read now, with the
    // viewer's access, so a topic hidden since then simply drops out.
    const rows = new Map(
      (await service.findManyByIds(slice.map(item => item.id))).map(row => [
        row.id,
        row,
      ]),
    );

    return c.json(
      {
        items: slice.flatMap(item => {
          const row = rows.get(item.id);
          if (!row) return [];

          return [
            {
              author: row.author,
              commentCount: item.commentCount,
              excerpt: excerptOf(row.body),
              forum: row.forum,
              id: row.id,
              lastActivityAt: item.lastActivityAt,
              publishedAt: iso(row.publishedAt),
              score: item.score,
              slug: row.slug,
              title: row.title,
            },
          ];
        }),
        pageInfo: {
          hasNextPage: visible.length > start + FORUM_FEED_PAGE_SIZE,
          page,
        },
      },
      200,
      headers,
    );
  },
});
