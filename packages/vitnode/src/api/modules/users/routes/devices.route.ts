import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import {
  listUserDevices,
  zodUserDeviceSchema,
} from "@/api/models/user-devices";
import { CONFIG_PLUGIN } from "@/config";

export const listDevicesRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "List the devices the current user is signed in on, with a session of either kind.",
    path: "/devices",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              devices: z.array(
                zodUserDeviceSchema.extend({ isCurrent: z.boolean() }),
              ),
            }),
          },
        },
        description: "List of the current user's devices",
      },
      401: {
        description: "Not signed in",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const currentPublicId = getCookie(
      c,
      c.get("core").authorization.deviceCookieName,
    );

    const devices = await listUserDevices(c, user.id);

    return c.json({
      devices: devices.map(device => ({
        ...device,
        isCurrent: device.publicId === currentPublicId,
      })),
    });
  },
});
