import type { Context } from "hono";

import { z } from "@hono/zod-openapi";

import { CONFIG_PLUGIN } from "@/config";

import { buildRoute } from "../../../lib/route";
import { zodPaginationQuery } from "../../../lib/with-pagination";
import { positiveIntOrUndefined, zodSearchResultSchema } from "./search.route";

export const zodSearchTimelineQuery = zodPaginationQuery.extend({
  lang: z.string().optional(),
});

export const zodSearchTimelineUserId = z
  .string()
  .regex(/^\d+$/, "Must be a whole number.")
  .openapi({ example: "1" });

export const searchTimeline = async (
  c: Context,
  {
    authorId,
    includePrivate,
    query,
  }: {
    authorId: number;
    includePrivate: boolean;
    query: z.infer<typeof zodSearchTimelineQuery>;
  },
) =>
  await c.get("search").search({
    authorId,
    cursor: query.cursor,
    first: positiveIntOrUndefined(query.first),
    includePrivate,
    languageCode: query.lang,
    sort: "newest",
  });

export const timelineRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "Indexed content credited to one member, newest first. Members also see their own drafts.",
    path: "/timeline/{userId}",
    request: {
      params: z.object({ userId: zodSearchTimelineUserId }),
      query: zodSearchTimelineQuery,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: zodSearchResultSchema,
          },
        },
        description: "Timeline",
      },
    },
  },
  handler: async c => {
    const authorId = Number(c.req.valid("param").userId);

    const result = await searchTimeline(c, {
      authorId,
      includePrivate: c.get("user")?.id === authorId,
      query: c.req.valid("query"),
    });

    return c.json(result, 200);
  },
});
