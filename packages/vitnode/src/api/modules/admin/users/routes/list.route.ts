import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/api/lib/with-pagination";
import { CONFIG_PLUGIN } from "@/config";
import { core_users } from "@/database/users";

export const listUsersAdminRoute = buildRoute({
  ...CONFIG_PLUGIN,
  route: {
    method: "get",
    description: "Get list of all users",
    path: "/list",
    request: {
      query: zodPaginationQuery.extend({
        order: z.enum(["asc", "desc"]).optional(),
        orderBy: z.enum(["name", "createdAt"]).optional(),
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
    const data = await withPagination({
      params: {
        query,
      },
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
            birthday: core_users.birthday,
            language: core_users.language,
          })
          .from(core_users)
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

    return c.json(data);
  },
});
