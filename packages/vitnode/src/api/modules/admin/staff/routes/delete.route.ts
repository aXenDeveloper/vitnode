import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import {
  assertStaffPermission,
  getUserRoleIds,
} from "@/api/lib/check-staff-permission";
import { buildRoute } from "@/api/lib/route";
import { invalidateStaffEntry } from "@/api/lib/staff-permission-cache";
import { CONFIG_PLUGIN } from "@/config";
import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";

import { staffPermissionModuleByType, staffTypeSchema } from "../lib/schema";

const tableByType = {
  admin: core_admin_permissions,
  moderator: core_moderators_permissions,
} as const;

export const deleteStaffAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "delete",
    description: "Remove a staff entry (Admin only)",
    path: "/entry/{type}/{id}",
    request: {
      params: z.object({
        type: staffTypeSchema,
        id: z.string().openapi({ example: "1" }),
      }),
    },
    responses: {
      200: {
        description: "Staff entry removed",
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
      permission: "can_delete",
    });

    const entryId = Number(id);
    if (!Number.isInteger(entryId)) {
      return c.json({ error: "Staff entry not found" }, 404);
    }

    const table = tableByType[type];
    const [entry] = await c
      .get("db")
      .select({
        protected: table.protected,
        userId: table.userId,
        roleId: table.roleId,
      })
      .from(table)
      .where(eq(table.id, entryId))
      .limit(1);

    if (!entry) {
      return c.json({ error: "Staff entry not found" }, 404);
    }
    // Protected entries are managed by the system and cannot be removed.
    if (entry.protected) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    // An admin cannot remove the entry that governs their own access - their own
    // user entry or an entry for any role they belong to (primary or secondary).
    const currentUser = c.get("admin")?.user;
    const currentUserRoleIds = currentUser
      ? await getUserRoleIds(c, currentUser)
      : [];
    const isSelf =
      currentUser != null &&
      ((entry.userId != null && entry.userId === currentUser.id) ||
        (entry.roleId != null && currentUserRoleIds.includes(entry.roleId)));
    if (isSelf) {
      throw new HTTPException(403, {
        message: "You cannot remove your own staff permissions.",
      });
    }

    await c.get("db").delete(table).where(eq(table.id, entryId));

    await invalidateStaffEntry(c, entry);

    return c.body(null, 200);
  },
});
