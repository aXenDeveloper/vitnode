import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";

import { zodSearchHitAuthor } from "./search.route";

export const SEARCH_AUTHORS_LIMIT = 10;

export const authorsRoute = buildRoute({
  route: {
    method: "get",
    description:
      "Members credited on public indexed content. With a term, members whose name contains it; without one, the most active members first.",
    path: "/authors",
    request: {
      query: z.object({
        search: z.string().trim().max(100).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ authors: z.array(zodSearchHitAuthor) }),
          },
        },
        description: "Authors",
      },
    },
  },
  handler: async c => {
    const { search } = c.req.valid("query");

    const authors = await c.get("search").authors({
      limit: SEARCH_AUTHORS_LIMIT,
      term: search === "" ? undefined : search,
    });

    return c.json({ authors });
  },
});
