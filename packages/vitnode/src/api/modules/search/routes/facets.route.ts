import { z } from "@hono/zod-openapi";

import { CONFIG_PLUGIN } from "@/config";
import { contentSearchHiddenAccess } from "@/content/server/hidden-access";

import { buildRoute } from "../../../lib/route";
import {
  dateOrUndefined,
  positiveIntListOrUndefined,
  positiveIntOrUndefined,
} from "./search.route";

export const facetsRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "How many results each content type would have under the given filters. `types` is null when the search provider cannot count.",
    path: "/facets",
    request: {
      query: z.object({
        search: z.string().optional(),
        authorIds: z.string().max(512).optional(),
        containerId: z.string().optional(),
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
              types: z.record(z.string(), z.number()).nullable(),
            }),
          },
        },
        description: "Result counts per content type",
      },
    },
  },
  handler: async c => {
    const query = c.req.valid("query");

    const types = await c.get("search").countByType({
      term: query.search,
      authorIds: positiveIntListOrUndefined(query.authorIds),
      containerId: positiveIntOrUndefined(query.containerId),
      dateFrom: dateOrUndefined(query.from),
      dateTo: dateOrUndefined(query.to),
      languageCode: query.lang,
      hiddenAccess: await contentSearchHiddenAccess(c),
      includePrivate: false,
    });

    return c.json({ types });
  },
});
