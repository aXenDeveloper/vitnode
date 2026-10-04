import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { updateNotificationTypePolicy } from "@/api/models/notifications/admin";
import { zodNotificationEmailMode } from "@/api/modules/notifications/schema";
import { CONFIG_PLUGIN } from "@/config";

export const updateNotificationTypePolicyRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "notifications", permission: "can_edit" },
  route: {
    method: "put",
    description:
      "Set the installation policy for one type: which channels it may use, the defaults for members who never chose, and whether members may change them.",
    path: "/types/{type}",
    request: {
      params: z.object({ type: z.string().max(100) }),
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              allowEmail: z.boolean().optional(),
              allowInApp: z.boolean().optional(),
              allowPush: z.boolean().optional(),
              email: zodNotificationEmailMode.optional(),
              enabled: z.boolean().optional(),
              inApp: z.boolean().optional(),
              memberCanEdit: z.boolean().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ success: z.boolean() }) },
        },
        description: "Saved",
      },
      400: { description: "Email for a type without an email channel" },
      403: { description: "Access Denied" },
      404: { description: "Unknown type" },
    },
  },
  handler: async c => {
    const { type } = c.req.valid("param");
    await updateNotificationTypePolicy(c, type, c.req.valid("json"));

    return c.json({ success: true });
  },
});
