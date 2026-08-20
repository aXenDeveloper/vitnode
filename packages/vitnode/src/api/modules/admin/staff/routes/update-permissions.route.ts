import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import {
  assertStaffPermission,
  getUserRoleIds,
} from "@/api/lib/check-staff-permission";
import { buildRoute } from "@/api/lib/route";
import { staffPermissionKey } from "@/api/lib/staff-permission";
import { invalidateStaffEntry } from "@/api/lib/staff-permission-cache";
import { CONFIG_PLUGIN } from "@/config";
import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";

import {
  permissionsStaffArgsSchema,
  staffPermissionModuleByType,
  staffTypeSchema,
} from "../lib/schema";

const tableByType = {
  admin: core_admin_permissions,
  moderator: core_moderators_permissions,
} as const;

export const updatePermissionsStaffAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "patch",
    description: "Update the granted permissions of a staff entry (Admin only)",
    path: "/entry/{type}/{id}",
    request: {
      params: z.object({
        type: staffTypeSchema,
        id: z.string().openapi({ example: "1" }),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              unrestricted: z.boolean(),
              permissions: z.array(permissionsStaffArgsSchema),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              unrestricted: z.boolean(),
              permissions: z.array(permissionsStaffArgsSchema),
            }),
          },
        },
        description: "Updated permissions",
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

    const { unrestricted, permissions } = c.req.valid("json");

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
    // Protected entries are managed by the system and cannot be edited.
    if (entry.protected) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    // An admin cannot edit the entry that governs their own access - their own
    // user entry or an entry for any role they belong to (primary or
    // secondary). This stops them from escalating their own permissions.
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
        message: "You cannot edit your own staff permissions.",
      });
    }

    // Only persist permissions that actually exist in the catalog for this
    // staff type - silently drops anything unknown/forged. Also record each
    // permission's dependencies (the keys of the permissions it `dependsOn`
    // within the same module) so we can drop grants whose gate is missing.
    const allowed = new Set<string>();
    const dependencies = new Map<string, string[]>();
    for (const plugin of c.get("core").permissionStaff) {
      for (const [module, modulePermissions] of Object.entries(plugin[type])) {
        for (const entry of modulePermissions) {
          const key = staffPermissionKey({
            plugin: plugin.pluginId,
            module,
            permission: entry.permission,
          });
          allowed.add(key);
          dependencies.set(
            key,
            entry.dependsOn.map(dependency =>
              staffPermissionKey({
                plugin: plugin.pluginId,
                module,
                permission: dependency,
              }),
            ),
          );
        }
      }
    }

    const seen = new Set<string>();
    const granted = new Map<string, PermissionsStaffArgs>();
    // When unrestricted, the explicit list is irrelevant - store none.
    if (!unrestricted) {
      for (const permission of permissions) {
        const key = staffPermissionKey(permission);
        if (!allowed.has(key) || seen.has(key)) continue;
        seen.add(key);
        granted.set(key, permission);
      }

      // Drop any granted permission whose dependencies aren't all granted too,
      // repeating until stable so a broken chain (a → b → c) collapses fully.
      let changed = true;
      while (changed) {
        changed = false;
        for (const key of granted.keys()) {
          const deps = dependencies.get(key) ?? [];
          if (deps.some(dependency => !granted.has(dependency))) {
            granted.delete(key);
            changed = true;
          }
        }
      }
    }

    const sanitized: PermissionsStaffArgs[] = [...granted.values()];

    const [updated] = await c
      .get("db")
      .update(table)
      .set({ unrestricted, permissions: sanitized })
      .where(eq(table.id, entryId))
      .returning({ id: table.id });

    if (!updated) {
      return c.json({ error: "Staff entry not found" }, 404);
    }

    await invalidateStaffEntry(c, entry);

    return c.json({ unrestricted, permissions: sanitized }, 200);
  },
});
