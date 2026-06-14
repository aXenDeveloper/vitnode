import { z } from "@hono/zod-openapi";
import { and, count, eq, ilike, inArray } from "drizzle-orm";

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

const rolesAdminListSchema = z.object({
  edges: z.array(
    z.object({
      id: z.number(),
      // Every translation of the role name — resolved to the active locale on
      // the frontend (see the `RoleFormat` component).
      name: z.array(
        z.object({
          name: z.string(),
          languageCode: z.string(),
        }),
      ),
      color: z.string().nullable(),
      protected: z.boolean(),
      default: z.boolean(),
      root: z.boolean(),
      guest: z.boolean(),
      createdAt: z.date(),
      usersCount: z.number(),
    }),
  ),
  pageInfo: zodPaginationPageInfo,
});

export const listRolesAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "Get list of all roles (Admin only)",
    path: "/list",
    request: {
      query: zodPaginationQuery.extend({
        order: z.enum(["asc", "desc"]).optional(),
        orderBy: z.enum(["id", "createdAt"]).optional(),
        search: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: rolesAdminListSchema,
          },
        },
        description: "List of roles",
      },
      403: {
        description: "Access Denied",
      },
    },
  },
  handler: async c => {
    const query = c.req.valid("query");
    const search = query.search?.trim();

    const data = await withPagination({
      params: {
        query,
      },
      // Role names live in `core_languages_words`, so search resolves matching
      // role ids from there instead of a column on `core_roles`.
      where: search
        ? inArray(
            core_roles.id,
            c
              .get("db")
              .select({ id: core_languages_words.itemId })
              .from(core_languages_words)
              .where(
                and(
                  eq(core_languages_words.tableName, "core_roles"),
                  eq(core_languages_words.variable, "name"),
                  eq(core_languages_words.pluginCode, "core"),
                  ilike(core_languages_words.value, `%${search}%`),
                ),
              ),
          )
        : undefined,
      primaryCursor: core_roles.id,
      query: async ({ limit, where, orderBy }) =>
        await c
          .get("db")
          .select({
            id: core_roles.id,
            color: core_roles.color,
            protected: core_roles.protected,
            default: core_roles.default,
            root: core_roles.root,
            guest: core_roles.guest,
            createdAt: core_roles.createdAt,
          })
          .from(core_roles)
          .where(where)
          .orderBy(orderBy)
          .limit(limit),
      table: core_roles,
      orderBy: {
        column: query.orderBy
          ? core_roles[query.orderBy]
          : core_roles.createdAt,
        order: query.order ?? "desc",
      },
      c,
    });

    const roleIds = data.edges.map(role => role.id);
    const names = roleIds.length
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
              inArray(core_languages_words.itemId, roleIds),
            ),
          )
      : [];
    const userCounts = roleIds.length
      ? await c
          .get("db")
          .select({
            roleId: core_users.roleId,
            total: count(),
          })
          .from(core_users)
          .where(inArray(core_users.roleId, roleIds))
          .groupBy(core_users.roleId)
      : [];

    return c.json({
      pageInfo: data.pageInfo,
      edges: data.edges.map(role => ({
        ...role,
        name: names
          .filter(word => word.itemId === role.id)
          .map(word => ({ name: word.value, languageCode: word.languageCode })),
        usersCount:
          userCounts.find(item => item.roleId === role.id)?.total ?? 0,
      })),
    });
  },
});
