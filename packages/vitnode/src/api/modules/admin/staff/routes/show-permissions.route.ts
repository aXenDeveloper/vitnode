import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { assertStaffPermission } from "@/api/lib/check-staff-permission";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";

import { resolveStaffEdges } from "../lib/resolve-staff-edges";
import {
  permissionsStaffArgsSchema,
  staffEntrySchema,
  staffPermissionModuleByType,
  staffTypeSchema,
} from "../lib/schema";

const tableByType = {
  admin: core_admin_permissions,
  moderator: core_moderators_permissions,
} as const;

export const showPermissionsStaffAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "Get a single staff entry with its granted permissions (Admin only)",
    path: "/entry/{type}/{id}",
    request: {
      params: z.object({
        type: staffTypeSchema,
        id: z.string().openapi({ example: "1" }),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: staffEntrySchema.extend({
              permissions: z.array(permissionsStaffArgsSchema),
            }),
          },
        },
        description: "Staff entry",
      },
      403: {
        description: "Access Denied",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Staff entry not found",
      },
    },
  },
  handler: async c => {
    const { type, id } = c.req.valid("param");
    await assertStaffPermission(c, {
      type: "admin",
      plugin: CONFIG_PLUGIN.pluginId,
      module: staffPermissionModuleByType[type],
      permission: "can_edit",
    });

    const entryId = Number(id);
    if (!Number.isInteger(entryId)) {
      return c.json({ error: "Staff entry not found" }, 404);
    }

    const table = tableByType[type];
    const [entry] = await c
      .get("db")
      .select({
        id: table.id,
        roleId: table.roleId,
        userId: table.userId,
        createdAt: table.createdAt,
        updatedAt: table.updatedAt,
        data: table.data,
        protected: table.protected,
      })
      .from(table)
      .where(eq(table.id, entryId))
      .limit(1);

    if (!entry) {
      return c.json({ error: "Staff entry not found" }, 404);
    }

    const [resolved] = await resolveStaffEdges(c, [entry]);

    return c.json(
      {
        ...resolved,
        permissions: entry.data?.permissions ?? [],
      },
      200,
    );
  },
});
