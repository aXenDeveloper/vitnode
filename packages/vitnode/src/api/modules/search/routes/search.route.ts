import { z } from "@hono/zod-openapi";

import { CONFIG_PLUGIN } from "@/config";

import { buildRoute } from "../../../lib/route";
import { zodPaginationPageInfo, zodPaginationQuery } from "../../../lib/with-pagination";

export const zodSearchHitSchema = z.object({
  id: z.number(),
  pluginId: z.string(),
  itemType: z.string(),
  itemId: z.number(),
  authorId: z.number().nullable(),
  title: z.string(),
  content: z.string(),
  containerType: z.string().nullable(),
  containerId: z.number().nullable(),
  url: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.date(),
  score: z.number().nullable(),
  author: z
    .object({
      id: z.number(),
      name: z.string(),
      nameCode: z.string(),
      avatarColor: z.string(),
    })
    .nullable(),
});

export const searchRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "Search and browse indexed community content.",
    path: "/",
    request: {
      query: zodPaginationQuery.extend({
        search: z.string().optional(),
        types: z.string().optional(),
        authorId: z.string().optional(),
        containerId: z.string().optional(),
        sort: z.enum(["newest", "oldest", "relevance"]).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              edges: z.array(zodSearchHitSchema),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: "Search results",
      },
    },
  },
  handler: async c => {
    const query = c.req.valid("query");

    const result = await c.get("search").search({
      term: query.search,
      itemTypes: query.types
        ? query.types.split(",").filter(Boolean)
        : undefined,
      authorId: query.authorId ? Number(query.authorId) : undefined,
      containerId: query.containerId ? Number(query.containerId) : undefined,
      sort: query.sort,
      dateFrom: query.from ? new Date(query.from) : undefined,
      dateTo: query.to ? new Date(query.to) : undefined,
      first: query.first ? Number(query.first) : undefined,
      cursor: query.cursor,
      includePrivate: false,
    });

    return c.json(result);
  },
});
