import { z } from "@hono/zod-openapi";

import { isStaff } from "@/api/lib/check-staff-permission";
import { resolveUserRoles, userRoleSchema } from "@/api/lib/resolve-user-roles";
import { buildRoute } from "@/api/lib/route";
import {
  resolveUserImagePolicy,
  zodUserImagePolicy,
} from "@/api/lib/user-images";
import { UserModel } from "@/api/models/user";
import { CONFIG_PLUGIN } from "@/config";

export const showUserAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_view" },
  route: {
    method: "get",
    description: "Get a single user by id (Admin only)",
    path: "/{id}",
    request: {
      params: z.object({
        id: z.string().openapi({ example: "1" }),
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
              avatarUrl: z.string().nullable(),
              coverUrl: z.string().nullable(),
              emailVerified: z.boolean(),
              roleId: z.number(),
              role: userRoleSchema,
              secondaryRoles: z.array(userRoleSchema),
              birthday: z.date().nullable(),
              language: z.string(),
              isAdmin: z.boolean(),
              imagePolicy: zodUserImagePolicy,
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
    const { id } = c.req.valid("param");
    const userId = Number(id);
    if (!Number.isInteger(userId)) {
      return c.json({ error: "User not found" }, 404);
    }

    const user = await new UserModel().getUserById({
      id: userId,
      c,
    });

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const [roles, isAdmin, imagePolicy] = await Promise.all([
      resolveUserRoles(c, user),
      isStaff(c, { type: "admin", userId: user.id }),
      resolveUserImagePolicy(c, user, { ignoreAllow: true }),
    ]);

    return c.json({ ...user, imagePolicy, isAdmin, ...roles }, 200);
  },
});
