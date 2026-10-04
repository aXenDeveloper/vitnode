import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { isValidTimeZone } from "@/api/lib/notifications/digest-period";
import { buildRoute } from "@/api/lib/route";
import { invalidateSessionCacheForUser } from "@/api/models/session-revoke";
import { CONFIG_PLUGIN } from "@/config";
import { core_users } from "@/database/users";

export const updateMyTimeZoneRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "put",
    description:
      "Set the signed-in user's time zone. It decides when their daily and weekly digests arrive; `null` falls back to their language's time zone.",
    path: "/me/time-zone",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              timeZone: z
                .string()
                .max(64)
                .nullable()
                .openapi({ example: "Europe/Warsaw" }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ timeZone: z.string().nullable() }),
          },
        },
        description: "Saved time zone",
      },
      400: { description: "Unknown time zone" },
      401: { description: "Unauthorized" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const { timeZone } = c.req.valid("json");
    if (timeZone !== null && !isValidTimeZone(timeZone)) {
      throw new HTTPException(400, { message: "Unknown time zone." });
    }

    await c
      .get("db")
      .update(core_users)
      .set({ timeZone })
      .where(eq(core_users.id, user.id));
    await invalidateSessionCacheForUser(c, user.id);
    await c.get("events").emit("user.updated", {
      email: user.email,
      name: user.name,
      userId: user.id,
    });

    return c.json({ timeZone }, 200);
  },
});
