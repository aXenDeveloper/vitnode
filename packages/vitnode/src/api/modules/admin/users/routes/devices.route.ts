import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import {
  listUserDevices,
  zodUserDeviceSchema,
} from "@/api/models/user-devices";
import { CONFIG_PLUGIN } from "@/config";

import {
  findTargetUserId,
  USER_NOT_FOUND,
  userNotFoundResponse,
  zodTargetUserIdParam,
} from "../lib/target-user";

export const listUserDevicesAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_view" },
  route: {
    method: "get",
    description:
      "List the devices a user is signed in on, with a session of either kind (Admin only)",
    path: "/{id}/devices",
    request: {
      params: z.object({ id: zodTargetUserIdParam }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ devices: z.array(zodUserDeviceSchema) }),
          },
        },
        description: "The user's devices, most recently seen first",
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

    return c.json({ devices: await listUserDevices(c, userId) }, 200);
  },
});
