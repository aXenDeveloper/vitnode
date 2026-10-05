import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { revokeSessions } from "@/api/models/session-revoke";
import { CONFIG_PLUGIN } from "@/config";

import { assertCanEditAdminTarget } from "../lib/assert-edit-user-permission";
import {
  findTargetUserId,
  USER_NOT_FOUND,
  userNotFoundResponse,
  zodTargetUserIdParam,
} from "../lib/target-user";

export const revokeUserDevicesAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_edit" },
  route: {
    method: "delete",
    description:
      "Sign a user out of every device, ending all user and AdminCP sessions (Admin only)",
    path: "/{id}/devices",
    request: {
      params: z.object({ id: zodTargetUserIdParam }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ ok: z.literal(true) }),
          },
        },
        description: "Every session of the user ended",
      },
      403: {
        description: "Access Denied",
      },
      404: userNotFoundResponse,
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const userId = await findTargetUserId(c, id);
    if (userId === null) return c.json(USER_NOT_FOUND, 404);

    await assertCanEditAdminTarget(c, userId);

    await revokeSessions(c, { userId });

    return c.json({ ok: true as const }, 200);
  },
});
