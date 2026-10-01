import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/lib/route";
import { revokeSessions } from "@/api/models/session-revoke";
import { CONFIG_PLUGIN } from "@/config";
import { core_admin_sessions } from "@/database/admins";
import {
  core_sessions,
  core_sessions_known_devices,
} from "@/database/sessions";

const hasSessionOn = async (
  c: Context,
  { deviceId, userId }: { deviceId: number; userId: number },
): Promise<boolean> => {
  const db = c.get("db");

  const [userSessions, adminSessions] = await Promise.all([
    db
      .select({ deviceId: core_sessions.deviceId })
      .from(core_sessions)
      .where(
        and(
          eq(core_sessions.userId, userId),
          eq(core_sessions.deviceId, deviceId),
        ),
      )
      .limit(1),
    db
      .select({ deviceId: core_admin_sessions.deviceId })
      .from(core_admin_sessions)
      .where(
        and(
          eq(core_admin_sessions.userId, userId),
          eq(core_admin_sessions.deviceId, deviceId),
        ),
      )
      .limit(1),
  ]);

  return userSessions.length > 0 || adminSessions.length > 0;
};

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
        description: "No session of the current user is on that device",
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

    if (
      !device ||
      !(await hasSessionOn(c, { deviceId: device.id, userId: user.id }))
    ) {
      return c.json({ error: "Device not found" }, 404);
    }

    await revokeSessions(c, { deviceId: device.id, userId: user.id });

    return c.body(null, 200);
  },
});
