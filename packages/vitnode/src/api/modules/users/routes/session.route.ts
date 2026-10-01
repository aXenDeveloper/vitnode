import { z } from "zod";

import { isStaff } from "@/api/lib/check-staff-permission";
import { buildRoute } from "@/api/lib/route";
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

    const [isAdmin, isModerator] = await Promise.all([
      isStaff(c, { type: "admin", userId: user.id }),
      isStaff(c, { type: "moderator", userId: user.id }),
    ]);

    return c.json({ user: { ...user, isAdmin, isModerator } });
  },
});
