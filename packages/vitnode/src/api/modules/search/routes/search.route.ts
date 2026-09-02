import { z } from "@hono/zod-openapi";

import { CONFIG_PLUGIN } from "@/config";

import { buildRoute } from "../../../lib/route";
import { zodPaginationQuery } from "../../../lib/with-pagination";

/**
 * The search index's own page info.
 *
 * Deliberately not `zodPaginationPageInfo`: that one describes a keyset walk
 * over a table and hands out an opaque cursor for the ordered tuple. A search
 * page is not that - a relevance-sorted one walks by offset and an ordinary one
 * by row id - so it keeps the numeric cursors it has always had.
 */
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

/**
 * A query parameter as a positive integer, or nothing.
 *
 * `Number("abc")` is `NaN` and `new Date("abc")` is an Invalid Date, and both
 * used to travel straight into the query builder - where Postgres rejects them,
 * which reaches the caller as a `500` and writes a `core_logs` row on the way.
 * This is a public, unauthenticated endpoint, so that was a log-flooding
 * primitive as much as it was a bad status code. A filter nobody can parse is
 * not an error; it is a filter that was not asked for.
 */
const positiveIntOrUndefined = (
  value: string | undefined,
): number | undefined => {
  if (value === undefined || value === "") return undefined;

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

/** A query parameter as a real date, or nothing. See above. */
const dateOrUndefined = (value: string | undefined): Date | undefined => {
  if (value === undefined || value === "") return undefined;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

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
      authorId: positiveIntOrUndefined(query.authorId),
      containerId: positiveIntOrUndefined(query.containerId),
      sort: query.sort,
      dateFrom: dateOrUndefined(query.from),
      dateTo: dateOrUndefined(query.to),
      first: positiveIntOrUndefined(query.first),
      cursor: query.cursor,
      languageCode: query.lang,
      includePrivate: false,
    });

    return c.json(result);
  },
});
