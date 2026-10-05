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
              role: userRoleSchema,
              secondaryRoles: z.array(userRoleSchema),
              birthday: z.date().nullable(),
              language: z.string(),
              timeZone: z.string().nullable(),
              isStaff: z.boolean(),
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

    const [roles, adminStaff, moderatorStaff, imagePolicy] = await Promise.all([
      resolveUserRoles(c, user),
      isStaff(c, { type: "admin", userId: user.id }),
      isStaff(c, { type: "moderator", userId: user.id }),
      resolveUserImagePolicy(c, user, { ignoreAllow: true }),
    ]);

    return c.json(
      {
        ...user,
        imagePolicy,
        isStaff: adminStaff || moderatorStaff,
        ...roles,
      },
      200,
    );
  },
});
