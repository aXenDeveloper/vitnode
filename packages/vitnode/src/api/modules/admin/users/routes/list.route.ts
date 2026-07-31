import { z } from "@hono/zod-openapi";
import { eq, inArray } from "drizzle-orm";

import { resolveRoleNames } from "@/api/lib/resolve-role-names";
import { buildRoute } from "@/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/api/lib/with-pagination";
import { CONFIG_PLUGIN } from "@/config";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";

export const listUsersAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_view" },
  route: {
    method: "get",
    description: "Get list of all users",
    path: "/list",
    request: {
      query: zodPaginationQuery.extend({
        order: z.enum(["asc", "desc"]).optional(),
        orderBy: z.enum(["name", "createdAt"]).optional(),
        roleId: z.string().optional(),
        search: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              edges: z.array(
                z.object({
                  id: z.number(),
                  name: z.string(),
                  email: z.string(),
                  nameCode: z.string(),
                  createdAt: z.date(),
                  newsletter: z.boolean(),
                  avatarColor: z.string(),
                  emailVerified: z.boolean(),
                  roleId: z.number(),
                  role: z.object({
                    id: z.number(),
                    color: z.string().nullable(),
                    name: z.array(
                      z.object({
                        name: z.string(),
                        languageCode: z.string(),
                      }),
                    ),
                  }),
                  secondaryRoles: z.array(
                    z.object({
                      id: z.number(),
                      color: z.string().nullable(),
                      name: z.array(
                        z.object({
                          name: z.string(),
                          languageCode: z.string(),
                        }),
                      ),
                    }),
                  ),
                  birthday: z.date().nullable(),
                  language: z.string(),
                }),
              ),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: "List of users",
      },
    },
  },
  handler: async c => {
    const query = c.req.valid("query");
    const roleIds = (query.roleId?.split(",") ?? [])
      .filter(Boolean)
      .map(id => Number(id))
      .filter(id => !Number.isNaN(id));
    const data = await withPagination({
      params: {
        query,
      },
      search: [core_users.name, core_users.email, core_users.nameCode],
      where: roleIds.length ? inArray(core_users.roleId, roleIds) : undefined,
      primaryCursor: core_users.id,
      query: async ({ limit, where, orderBy }) =>
        await c
          .get("db")
          .select({
            id: core_users.id,
            name: core_users.name,
            email: core_users.email,
            nameCode: core_users.nameCode,
            createdAt: core_users.createdAt,
            newsletter: core_users.newsletter,
            avatarColor: core_users.avatarColor,
            emailVerified: core_users.emailVerified,
            roleId: core_users.roleId,
            roleColor: core_roles.color,
            birthday: core_users.birthday,
            language: core_users.language,
          })
          .from(core_users)
          .leftJoin(core_roles, eq(core_roles.id, core_users.roleId))
          .where(where)
          .orderBy(orderBy)
          .limit(limit),
      table: core_users,
      orderBy: {
        column: query.orderBy
          ? core_users[query.orderBy]
          : core_users.createdAt,
        order: query.order ?? "desc",
      },
      c,
    });

    // Secondary roles are a user<->role join, so collect every assignment for
    // the listed users in a single query (with the role color alongside).
    const userIds = data.edges.map(user => user.id);
    const secondaryRoleRows = userIds.length
      ? await c
          .get("db")
          .select({
            userId: core_users_secondary_roles.userId,
            roleId: core_users_secondary_roles.roleId,
            roleColor: core_roles.color,
          })
          .from(core_users_secondary_roles)
          .innerJoin(
            core_roles,
            eq(core_roles.id, core_users_secondary_roles.roleId),
          )
          .where(inArray(core_users_secondary_roles.userId, userIds))
      : [];

    // Role names live in `core_languages_words`, so resolve the translations for
    // every role referenced by the listed users (primary and secondary) at once.
    const roleNames = await resolveRoleNames(c, [
      ...data.edges.map(user => user.roleId),
      ...secondaryRoleRows.map(row => row.roleId),
    ]);

    return c.json({
      pageInfo: data.pageInfo,
      edges: data.edges.map(({ roleColor, ...user }) => ({
        ...user,
        role: {
          id: user.roleId,
          color: roleColor,
          name: roleNames.get(user.roleId) ?? [],
        },
        secondaryRoles: secondaryRoleRows
          .filter(row => row.userId === user.id)
          .map(row => ({
            id: row.roleId,
            color: row.roleColor,
            name: roleNames.get(row.roleId) ?? [],
          })),
      })),
    });
  },
});
