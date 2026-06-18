import { z } from "@hono/zod-openapi";
import { and, eq, inArray } from "drizzle-orm";

import { buildRoute } from "@/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/api/lib/with-pagination";
import { CONFIG_PLUGIN } from "@/config";
import { core_languages_words } from "@/database/languages";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";

export const listUsersAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
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
      search: [core_users.name, core_users.email],
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

    // Role names live in `core_languages_words`, so resolve the translations
    // for every role referenced by the listed users in a single query.
    const userRoleIds = [...new Set(data.edges.map(user => user.roleId))];
    const roleNames = userRoleIds.length
      ? await c
          .get("db")
          .select({
            itemId: core_languages_words.itemId,
            languageCode: core_languages_words.languageCode,
            value: core_languages_words.value,
          })
          .from(core_languages_words)
          .where(
            and(
              eq(core_languages_words.tableName, "core_roles"),
              eq(core_languages_words.variable, "name"),
              eq(core_languages_words.pluginCode, "core"),
              inArray(core_languages_words.itemId, userRoleIds),
            ),
          )
      : [];

    return c.json({
      pageInfo: data.pageInfo,
      edges: data.edges.map(({ roleColor, ...user }) => ({
        ...user,
        role: {
          id: user.roleId,
          color: roleColor,
          name: roleNames
            .filter(word => word.itemId === user.roleId)
            .map(word => ({
              name: word.value,
              languageCode: word.languageCode,
            })),
        },
      })),
    });
  },
});
