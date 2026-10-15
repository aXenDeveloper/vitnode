import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { MAX_SEARCH_SUGGESTIONS } from "@/api/lib/search-suggestions";
import { contentSearchHiddenAccess } from "@/content/server/hidden-access";

import { positiveIntOrUndefined } from "./search.route";

const DEFAULT_SEARCH_SUGGESTIONS = 6;

export const zodSearchSuggestion = z.object({
  context: z.string().nullable(),
  createdAt: z.date(),
  excerpt: z.string(),
  id: z.number(),
  image: z
    .object({
      height: z.number().optional(),
      url: z.string(),
      width: z.number().optional(),
    })
    .nullable(),
  itemId: z.string(),
  itemType: z.string(),
  title: z.string(),
  url: z.string(),
});

export const searchSuggestionsLimit = (first: string | undefined): number =>
  Math.min(
    positiveIntOrUndefined(first) ?? DEFAULT_SEARCH_SUGGESTIONS,
    MAX_SEARCH_SUGGESTIONS,
  );

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
