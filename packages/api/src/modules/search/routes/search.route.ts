import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/builders";
import { contentSearchHiddenAccess } from "@/content/server/hidden-access";

import { zodPaginationQuery } from "../../../lib/with-pagination";
import {
  dateOrUndefined,
  positiveIntListOrUndefined,
  positiveIntOrUndefined,
} from "../lib/query-params";
import { zodSearchResultSchema } from "../search.schema";

export const searchRoute = buildRoute({
  mcp: {
    description:
      "Searches the community's public content (articles, topics, comments and anything else plugins index) by keywords, newest or most relevant first. Narrow it with `types` (comma-separated item types), `authorIds` (comma-separated member ids), `from` and `to` (ISO dates) and `lang`; page with `first` and the returned `pageInfo.endCursor` as `cursor`. Each hit has a title, an excerpt and its URL.",
  },
  route: {
    method: "get",
    description: "Search and browse indexed community content.",
    path: "/",
    request: {
      query: zodPaginationQuery.extend({
        search: z.string().max(200).optional(),
        types: z.string().max(512).optional(),
        authorId: z.string().optional(),
        authorIds: z.string().max(512).optional(),
        containerId: z.string().optional(),
        sort: z.enum(["newest", "oldest", "relevance"]).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        lang: z.string().max(32).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: zodSearchResultSchema,
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
      authorIds: positiveIntListOrUndefined(query.authorIds),
      containerId: positiveIntOrUndefined(query.containerId),
      sort: query.sort,
      dateFrom: dateOrUndefined(query.from),
      dateTo: dateOrUndefined(query.to),
      first: positiveIntOrUndefined(query.first),
      cursor: query.cursor,
      languageCode: query.lang,
      hiddenAccess: await contentSearchHiddenAccess(c),
      includePrivate: false,
    });

    return c.json(result);
  },
});
