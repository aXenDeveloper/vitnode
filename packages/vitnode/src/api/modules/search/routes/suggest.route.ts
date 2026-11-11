import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { contentSearchHiddenAccess } from "@/content/server/hidden-access";

import { searchSuggestionsLimit } from "../lib/query-params";
import { zodSearchSuggestion } from "../search.schema";

export const suggestRoute = buildRoute({
  route: {
    method: "get",
    description:
      "As-you-type suggestions: content whose title words start with what was typed, best match first and the more popular item on a tie.",
    path: "/suggest",
    request: {
      query: z.object({
        search: z.string().trim().min(1).max(100),
        first: z.string().optional(),
        lang: z.string().max(32).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ items: z.array(zodSearchSuggestion) }),
          },
        },
        description: "Suggestions",
      },
    },
  },
  handler: async c => {
    const { first, lang, search } = c.req.valid("query");

    const items = await c.get("search").suggest({
      hiddenAccess: await contentSearchHiddenAccess(c),
      includePrivate: false,
      languageCode: lang,
      limit: searchSuggestionsLimit(first),
      term: search,
    });

    return c.json({ items });
  },
});
