import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";
import { resolveMentionPolicy } from "@/lib/mentions/policy";
import {
  MENTION_SUGGESTIONS_MAX,
  searchMentionCandidates,
} from "@/models/mentions/users";

export const mentionSuggestionsRoute = buildRoute({
  route: {
    method: "get",
    description:
      "Members to offer in the editor's `@` popup: URL name or name starting with the term first, then names containing it. Needs a role that may mention.",
    path: "/mentions",
    request: {
      query: z.object({
        search: z.string().trim().min(1).max(64),
        limit: z.coerce
          .number()
          .int()
          .min(1)
          .max(MENTION_SUGGESTIONS_MAX)
          .optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              users: z.array(
                z.object({
                  id: z.number(),
                  name: z.string(),
                  nameCode: z.string(),
                  avatarColor: z.string(),
                  avatarUrl: z.string().nullable(),
                }),
              ),
            }),
          },
        },
        description: "Matching members",
      },
      401: { description: "Not signed in" },
      403: { description: "None of the member's roles may mention" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    const policy = await resolveMentionPolicy(c);
    if (!policy.canMention) {
      throw new HTTPException(403, { message: "Mentions are not allowed" });
    }

    const { limit = 6, search } = c.req.valid("query");
    const users = await searchMentionCandidates(c, {
      excludeUserId: user.id,
      limit,
      term: search,
    });

    return c.json({ users }, 200, { "Cache-Control": "private, max-age=30" });
  },
});
