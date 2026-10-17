import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import { invalidateSessionCacheForUser } from "@/api/models/session-revoke";
import { core_users } from "@/database/users";

const zodPrivacy = z.object({
  hideOnlineStatus: z.boolean().openapi({ example: true }),
});

export const updateMyPrivacyRoute = buildRoute({
  route: {
    method: "put",
    description:
      "Browse anonymously: hide the signed-in user's online status and last activity from other members. Staff with `users:can_view_hidden_presence` still see it. Takes effect on the next presence read.",
    path: "/me/privacy",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: zodPrivacy } },
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: zodPrivacy } },
        description: "Saved privacy settings",
      },
      401: { description: "Unauthorized" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const { hideOnlineStatus } = c.req.valid("json");

    await c
      .get("db")
      .update(core_users)
      .set({ hideOnlineStatus })
      .where(eq(core_users.id, user.id));
    await invalidateSessionCacheForUser(c, user.id);
    await c.get("events").emit("user.updated", {
      email: user.email,
      name: user.name,
      userId: user.id,
    });

    return c.json({ hideOnlineStatus }, 200);
  },
});
