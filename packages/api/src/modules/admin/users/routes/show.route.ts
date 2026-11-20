import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/builders";
import { findOpenAccountDeletion } from "@/lib/account-deletion/requests";
import { isStaff } from "@/lib/check-staff-permission";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { resolveUserRoles, userRoleSchema } from "@/lib/resolve-user-roles";
import { resolveUserImagePolicy, zodUserImagePolicy } from "@/lib/user-images";
import { UserModel } from "@/models/user";

export const showUserAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.users.canView,
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
              /** The open deletion request: pending, or failed and waiting for a retry. */
              pendingDeletion: z
                .object({
                  attempts: z.number(),
                  id: z.number(),
                  lastError: z.string().nullable(),
                  scheduledAt: z.date(),
                  source: z.enum(["user", "admin"]),
                  status: z.enum(["pending", "failed"]),
                })
                .nullable(),
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

    const [roles, adminStaff, moderatorStaff, imagePolicy, pendingDeletion] =
      await Promise.all([
        resolveUserRoles(c, user),
        isStaff(c, { type: "admin", userId: user.id }),
        isStaff(c, { type: "moderator", userId: user.id }),
        resolveUserImagePolicy(c, user, { ignoreAllow: true }),
        findOpenAccountDeletion(c, user.id),
      ]);

    return c.json(
      {
        ...user,
        imagePolicy,
        isStaff: adminStaff || moderatorStaff,
        pendingDeletion: pendingDeletion
          ? {
              attempts: pendingDeletion.attempts,
              id: pendingDeletion.id,
              lastError: pendingDeletion.lastError,
              scheduledAt: pendingDeletion.scheduledAt,
              source: pendingDeletion.source,
              status: pendingDeletion.status,
            }
          : null,
        ...roles,
      },
      200,
    );
  },
});
