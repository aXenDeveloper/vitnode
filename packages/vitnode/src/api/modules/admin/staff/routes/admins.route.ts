import { buildRoute } from "@/api/lib/route";
import { withPagination } from "@/api/lib/with-pagination";
import { CONFIG_PLUGIN } from "@/config";
import { core_admin_permissions } from "@/database/admins";

import { resolveStaffEdges } from "../lib/resolve-staff-edges";
import { staffListAdminQuery, staffListAdminSchema } from "../lib/schema";

export const listAdminsStaffAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "staff_admins", permission: "can_view" },
  route: {
    method: "get",
    description: "Get list of administrators staff (Admin only)",
    path: "/admins",
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
        description: "List of administrators staff",
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
      primaryCursor: core_admin_permissions.id,
      query: async ({ limit, where, orderBy }) =>
        await c
          .get("db")
          .select({
            id: core_admin_permissions.id,
            roleId: core_admin_permissions.roleId,
            userId: core_admin_permissions.userId,
            createdAt: core_admin_permissions.createdAt,
            updatedAt: core_admin_permissions.updatedAt,
            data: core_admin_permissions.data,
            protected: core_admin_permissions.protected,
          })
          .from(core_admin_permissions)
          .where(where)
          .orderBy(orderBy)
          .limit(limit),
      table: core_admin_permissions,
      orderBy: {
        column: query.orderBy
          ? core_admin_permissions[query.orderBy]
          : core_admin_permissions.updatedAt,
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
