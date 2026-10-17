import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { UserPresenceModel } from "@/api/models/user-presence";

import {
  presenceResponseHeaders,
  zodPresenceUserId,
  zodUserPresence,
} from "../presence-schema";

export const presenceRoute = buildRoute({
  route: {
    method: "get",
    description:
      "One member's online status and last activity, as the signed-in viewer may see it. Anonymous members read as `hidden` unless the viewer is them or holds `users:can_view_hidden_presence`.",
    path: "/{id}/presence",
    request: {
      params: z.object({ id: zodPresenceUserId }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: zodUserPresence } },
        description: "Presence",
      },
      404: {
        content: {
          "application/json": { schema: z.object({ error: z.string() }) },
        },
        description: "User not found",
      },
    },
  },
  handler: async c => {
    const userId = Number(c.req.valid("param").id);
    const presence = await new UserPresenceModel(c).get({ userId });

    if (!presence) {
      return c.json({ error: "User not found" }, 404, presenceResponseHeaders);
    }

    return c.json(presence, 200, presenceResponseHeaders);
  },
});
