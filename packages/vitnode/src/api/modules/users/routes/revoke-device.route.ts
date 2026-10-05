import { z } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/lib/route";
import { revokeSessions } from "@/api/models/session-revoke";
import { findUserDeviceId } from "@/api/models/user-devices";
import { CONFIG_PLUGIN } from "@/config";

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

    const deviceId = await findUserDeviceId(c, { publicId, userId: user.id });
    if (deviceId === null) {
      return c.json({ error: "Device not found" }, 404);
    }

    await revokeSessions(c, { deviceId, userId: user.id });

    return c.body(null, 200);
  },
});
