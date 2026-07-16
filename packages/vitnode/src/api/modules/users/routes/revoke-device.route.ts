import { z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/lib/route";
import {
  adminSessionCacheKey,
  sessionCacheKey,
} from "@/api/models/session-cache";
import { CONFIG_PLUGIN } from "@/config";
import {
  core_sessions,
  core_sessions_known_devices,
} from "@/database/sessions";

export const revokeDeviceRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "delete",
    description: "Sign out one of the current user's devices.",
    path: "/devices/{publicId}",
    request: {
      params: z.object({
        publicId: z.string().openapi({ example: "a1b2c3" }),
      }),
    },
    responses: {
      200: {
        description: "Device signed out",
      },
      400: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Cannot revoke the current device",
      },
      401: {
        description: "Not signed in",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Device not found",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const { publicId } = c.req.valid("param");
    const currentPublicId = getCookie(
      c,
      c.get("core").authorization.deviceCookieName,
    );
    if (publicId === currentPublicId) {
      return c.json({ error: "Cannot revoke the current device" }, 400);
    }

    const db = c.get("db");
    const [device] = await db
      .select({ id: core_sessions_known_devices.id })
      .from(core_sessions_known_devices)
      .where(eq(core_sessions_known_devices.publicId, publicId));

    if (!device) {
      return c.json({ error: "Device not found" }, 404);
    }

    const where = and(
      eq(core_sessions.userId, user.id),
      eq(core_sessions.deviceId, device.id),
    );

    const sessions = await db
      .select({ token: core_sessions.token })
      .from(core_sessions)
      .where(where);

    await db.delete(core_sessions).where(where);

    const cache = c.get("cache");
    await cache.deleteSystem(
      sessions.flatMap(({ token }) => [
        sessionCacheKey(token, device.id),
        adminSessionCacheKey(token, device.id),
      ]),
    );

    return c.body(null, 200);
  },
});
