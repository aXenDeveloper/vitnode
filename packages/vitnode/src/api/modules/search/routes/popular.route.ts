import { z } from "@hono/zod-openapi";

import { CONFIG_PLUGIN } from "@/config";

import { buildRoute } from "../../../lib/route";
import { searchSuggestionsLimit, zodSearchSuggestion } from "./suggest.route";

export const popularRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "Public content people are looking at right now, ranked by recent views, search clicks and new comments.",
    path: "/popular",
    request: {
      query: z.object({
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
        description: "Popular content",
      },
    },
  },
  handler: async c => {
    const { first, lang } = c.req.valid("query");

    const items = await c
      .get("search")
      .popular({ languageCode: lang, limit: searchSuggestionsLimit(first) });

    return c.json({ items });
  },
});
