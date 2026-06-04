import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { UserModel } from "@/api/models/user";
import { CONFIG_PLUGIN } from "@/config";

export const showUserAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "Get a single user by name SEO (Admin only)",
    path: "/{nameCode}",
    request: {
      params: z.object({
        nameCode: z.string().openapi({ example: "test" }),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              id: z.number(),
              name: z.string(),
              email: z.string(),
              nameCode: z.string(),
              createdAt: z.date(),
              newsletter: z.boolean(),
              avatarColor: z.string(),
              emailVerified: z.boolean(),
              roleId: z.number(),
              birthday: z.date().nullable(),
              language: z.string(),
            }),
          },
        },
        description: "User found",
      },
      403: {
        description: "Access Denied",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({
              error: z.string(),
            }),
          },
        },
        description: "User not found",
      },
    },
  },
  handler: async c => {
    const { nameCode } = c.req.valid("param");
    const user = await new UserModel().getUserByNameCode({
      nameCode,
      c,
    });

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json(user, 200);
  },
});
