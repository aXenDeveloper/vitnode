import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { contentSearchHiddenAccess } from "@/content/server/hidden-access";

import { searchTimeline } from "../lib/timeline";
import {
  zodSearchResultSchema,
  zodSearchTimelineQuery,
  zodSearchTimelineUserId,
} from "../search.schema";

export const timelineRoute = buildRoute({
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
      hiddenAccess: await contentSearchHiddenAccess(c),
      includePrivate: false,
      query: c.req.valid("query"),
    });

    return c.json(result, 200);
  },
});
