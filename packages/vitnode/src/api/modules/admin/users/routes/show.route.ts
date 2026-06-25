import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { resolveRoleNames } from "@/api/lib/resolve-role-names";
import { buildRoute } from "@/api/lib/route";
import { UserModel } from "@/api/models/user";
import { CONFIG_PLUGIN } from "@/config";
import { core_roles } from "@/database/roles";
import { core_users_secondary_roles } from "@/database/users";

const roleSchema = z.object({
  id: z.number(),
  color: z.string().nullable(),
  name: z.array(
    z.object({
      name: z.string(),
      languageCode: z.string(),
    }),
  ),
});

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
              role: roleSchema,
              secondaryRoles: z.array(roleSchema),
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

    const db = c.get("db");
    const secondaryRoleRows = await db
      .select({
        id: core_roles.id,
        color: core_roles.color,
      })
      .from(core_users_secondary_roles)
      .innerJoin(
        core_roles,
        eq(core_roles.id, core_users_secondary_roles.roleId),
      )
      .where(eq(core_users_secondary_roles.userId, user.id));

    const [primaryRole] = await db
      .select({ id: core_roles.id, color: core_roles.color })
      .from(core_roles)
      .where(eq(core_roles.id, user.roleId))
      .limit(1);

    const names = await resolveRoleNames(c, [
      user.roleId,
      ...secondaryRoleRows.map(role => role.id),
    ]);

    return c.json(
      {
        ...user,
        role: {
          id: user.roleId,
          color: primaryRole?.color ?? null,
          name: names.get(user.roleId) ?? [],
        },
        secondaryRoles: secondaryRoleRows.map(role => ({
          id: role.id,
          color: role.color,
          name: names.get(role.id) ?? [],
        })),
      },
      200,
    );
  },
});
