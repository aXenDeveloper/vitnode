import { buildRoute } from "@/api/lib/route";
import { withPagination } from "@/api/lib/with-pagination";
import { CONFIG_PLUGIN } from "@/config";
import { core_moderators_permissions } from "@/database/moderators";

import { resolveStaffEdges } from "../lib/resolve-staff-edges";
import { staffListAdminQuery, staffListAdminSchema } from "../lib/schema";

export const listModeratorsStaffAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "Get list of moderators staff (Admin only)",
    path: "/moderators",
    request: {
      query: staffListAdminQuery,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: staffListAdminSchema,
          },
        },
        description: "List of moderators staff",
      },
      403: {
        description: "Access Denied",
      },
    },
  },
  handler: async c => {
    const query = c.req.valid("query");

    const data = await withPagination({
      params: {
        query,
      },
      primaryCursor: core_moderators_permissions.id,
      query: async ({ limit, where, orderBy }) =>
        await c
          .get("db")
          .select({
            id: core_moderators_permissions.id,
            roleId: core_moderators_permissions.roleId,
            userId: core_moderators_permissions.userId,
            createdAt: core_moderators_permissions.createdAt,
            updatedAt: core_moderators_permissions.updatedAt,
          })
          .from(core_moderators_permissions)
          .where(where)
          .orderBy(orderBy)
          .limit(limit),
      table: core_moderators_permissions,
      orderBy: {
        column: query.orderBy
          ? core_moderators_permissions[query.orderBy]
          : core_moderators_permissions.updatedAt,
        order: query.order ?? "desc",
      },
      c,
    });

    return c.json({
      pageInfo: data.pageInfo,
      edges: await resolveStaffEdges(c, data.edges),
    });
  },
});
