import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { UserPresenceModel } from "@/api/models/user-presence";
import {
  presenceResponseHeaders,
  zodPresenceUserId,
  zodUserPresence,
} from "@/api/modules/users/presence-schema";

export const presenceUserAdminRoute = buildRoute({
  adminStaffPermission: { module: "users", permission: "can_view" },
  route: {
    method: "get",
    description:
      "A member's online status and last activity for the AdminCP. A member browsing anonymously reads as `hidden` unless the admin also holds `users:can_view_hidden_presence`.",
    path: "/{id}/presence",
    request: {
      params: z.object({ id: zodPresenceUserId }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: zodUserPresence } },
        description: "Presence",
      },
      403: { description: "Access Denied" },
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
    const presence = await new UserPresenceModel(c).get({
      userId,
      viewer: { type: "admin", user: c.get("admin")?.user ?? null },
    });

    if (!presence) {
      return c.json({ error: "User not found" }, 404, presenceResponseHeaders);
    }

    return c.json(presence, 200, presenceResponseHeaders);
  },
});
