import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { getStaffFlags } from "@/api/lib/check-staff-permission";
import { getNotificationState } from "@/api/models/notifications/inbox";
import { zodNotificationState } from "@/api/modules/notifications/schema";

export const sessionRoute = buildRoute({
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
                  hideOnlineStatus: z.boolean(),
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
                  notifications: zodNotificationState,
                })
                .nullable(),
              suspension: z
                .object({ endsAt: z.date().nullable() })
                .nullable()
                .optional()
                .describe(
                  "Set while the session's account is suspended; `user` is then `null`",
                ),
            }),
          },
        },
        description: "User",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      const suspension = c.get("suspension");

      return c.json({
        user: null,
        suspension: suspension ? { endsAt: suspension.endsAt } : null,
      });
    }

    const [{ isAdmin, isModerator }, notifications] = await Promise.all([
      getStaffFlags(c, user),
      getNotificationState(c.get("db"), user.id),
    ]);

    return c.json({ user: { ...user, isAdmin, isModerator, notifications } });
  },
});
