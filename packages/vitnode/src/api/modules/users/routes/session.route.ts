import { z } from "zod";

import { isStaff } from "@/api/lib/check-staff-permission";
import { buildRoute } from "@/api/lib/route";
import { getNotificationState } from "@/api/models/notifications/inbox";
import { CONFIG_PLUGIN } from "@/config";

export const sessionRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "Verify session",
    path: "/session",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              user: z
                .object({
                  id: z.number(),
                  email: z.string(),
                  name: z.string(),
                  nameCode: z.string(),
                  firstName: z.string().nullable(),
                  lastName: z.string().nullable(),
                  phone: z.string().nullable(),
                  headline: z.string().nullable(),
                  showRealName: z.boolean(),
                  timeZone: z.string().nullable(),
                  createdAt: z.date(),
                  newsletter: z.boolean(),
                  avatarColor: z.string(),
                  avatarUrl: z.string().nullable(),
                  coverUrl: z.string().nullable(),
                  emailVerified: z.boolean(),
                  roleId: z.number(),
                  birthday: z.date().nullable(),
                  isAdmin: z.boolean(),
                  isModerator: z.boolean(),
                  /**
                   * The canonical unread count and its revision. A client keeps
                   * whichever state - this or a WebSocket update - has the
                   * higher revision.
                   */
                  notifications: z.object({
                    revision: z.number(),
                    unread: z.number(),
                  }),
                })
                .nullable(),
            }),
          },
        },
        description: "User",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) return c.json({ user: null });

    const [isAdmin, isModerator, notifications] = await Promise.all([
      isStaff(c, { type: "admin", userId: user.id }),
      isStaff(c, { type: "moderator", userId: user.id }),
      // One primary-key read - never cached with the session user, so a
      // count changed by another tab or device is never served stale.
      getNotificationState(c.get("db"), user.id),
    ]);

    return c.json({ user: { ...user, isAdmin, isModerator, notifications } });
  },
});
