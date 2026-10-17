import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { UserPresenceModel } from "@/api/models/user-presence";
import { PRESENCE_BATCH_MAX_USERS } from "@/lib/user-presence";

import { presenceResponseHeaders, zodUserPresence } from "../presence-schema";

export const presenceBatchRoute = buildRoute({
  route: {
    method: "post",
    description: `Presence of up to ${PRESENCE_BATCH_MAX_USERS} members at once - for member lists, comment threads and anything else showing many users. Unknown IDs are left out.`,
    path: "/presence/batch",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              userIds: z
                .array(z.number().int().positive().max(2_147_483_647))
                .min(1)
                .max(PRESENCE_BATCH_MAX_USERS)
                .openapi({ example: [1, 2, 3] }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              presences: z.array(
                z.object({ userId: z.number(), presence: zodUserPresence }),
              ),
            }),
          },
        },
        description: "Presence of every member found",
      },
    },
  },
  handler: async c => {
    const { userIds } = c.req.valid("json");
    const presences = await new UserPresenceModel(c).getMany({ userIds });

    return c.json(
      {
        presences: [...presences].map(([userId, presence]) => ({
          presence,
          userId,
        })),
      },
      200,
      presenceResponseHeaders,
    );
  },
});
