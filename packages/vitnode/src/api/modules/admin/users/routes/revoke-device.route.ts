import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { revokeSessions } from "@/api/models/session-revoke";
import { findUserDeviceId } from "@/api/models/user-devices";
import { CONFIG_PLUGIN } from "@/config";

import { assertCanEditAdminTarget } from "../lib/assert-edit-user-permission";
import {
  findTargetUserId,
  USER_NOT_FOUND,
  zodTargetUserIdParam,
} from "../lib/target-user";

export const revokeUserDeviceAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_edit" },
  route: {
    method: "delete",
    description:
      "Sign a user out of one device, ending both its user and AdminCP sessions (Admin only)",
    path: "/{id}/devices/{publicId}",
    request: {
      params: z.object({
        id: zodTargetUserIdParam,
        publicId: z
          .string()
          .regex(/^[A-Za-z0-9_-]{1,128}$/)
          .openapi({ example: "a1b2c3" }),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ ok: z.literal(true) }),
          },
        },
        description: "Device signed out",
      },
      403: {
        description: "Access Denied",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Unknown user, or the user has no session on that device",
      },
    },
  },
  handler: async c => {
    const { id, publicId } = c.req.valid("param");
    const userId = await findTargetUserId(c, id);
    if (userId === null) return c.json(USER_NOT_FOUND, 404);

    await assertCanEditAdminTarget(c, userId);

    const deviceId = await findUserDeviceId(c, { publicId, userId });
    if (deviceId === null) {
      return c.json({ error: "Device not found" }, 404);
    }

    await revokeSessions(c, { deviceId, userId });

    return c.json({ ok: true as const }, 200);
  },
});
