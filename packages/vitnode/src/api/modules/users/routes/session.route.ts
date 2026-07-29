import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { SessionAdminModel } from "@/api/models/session-admin";
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
              // Configured AI models (empty when AI is not set up). The first
              // entry is the default. `model` is the provider model id string.
              ai: z.object({
                models: z.array(
                  z.object({
                    id: z.string(),
                    model: z.string(),
                    name: z.string(),
                  }),
                ),
              }),
              user: z
                .object({
                  id: z.number(),
                  email: z.string(),
                  name: z.string(),
                  nameCode: z.string(),
                  createdAt: z.date(),
                  newsletter: z.boolean(),
                  avatarColor: z.string(),
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
    const admin = new SessionAdminModel(c);

    return c.json({
      ai: { models: c.get("ai").models() },
      user: user
        ? {
            ...user,
            isAdmin: await admin.checkIfUserIsAdmin(user.id),
            isModerator: false, // TODO: implement moderator role
          }
        : null,
    });
  },
});
