import { z } from "@hono/zod-openapi";

import { CONFIG_PLUGIN } from "@/config";

import { buildRoute } from "../../../lib/route";
import { zodPaginationQuery } from "../../../lib/with-pagination";

const zodSearchPageInfo = z.object({
  totalCount: z.number(),
  count: z.number(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  startCursor: z.number().nullable(),
  endCursor: z.number().nullable(),
});

export const zodSearchHitSchema = z.object({
  id: z.number(),
  pluginId: z.string(),
  itemType: z.string(),
  itemId: z.number(),
  languageCode: z.string(),
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
        lang: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              edges: z.array(zodSearchHitSchema),
              // The search index has its own pagination - a relevance-sorted
              // page walks by offset, and an ordinary one by row id - so it
              // keeps the numeric cursors it has always had rather than the
              // opaque keyset cursor `withPagination` mints for a table.
              pageInfo: zodSearchPageInfo,
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
      languageCode: query.lang,
      includePrivate: false,
    });

    return c.json(result);
  },
});
