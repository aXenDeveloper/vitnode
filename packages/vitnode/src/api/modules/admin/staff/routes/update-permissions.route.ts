import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { buildRoute } from "@/api/builders";
import {
  staffEntryAuditLabel,
  staffGrantsAuditDelta,
} from "@/api/lib/audit/labels";
import { writeAuditLog } from "@/api/lib/audit/write";
import { assertStaffPermission } from "@/api/lib/check-staff-permission";
import { invalidateStaffEntry } from "@/api/lib/staff-permission-cache";
import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { auditDiff } from "@/lib/audit/diff";
import { manifest } from "@/manifest";

import {
  permissionsStaffArgsSchema,
  staffGrantIssueSchema,
  staffPermissionModuleByType,
  staffTypeSchema,
} from "../lib/schema";
import { sanitizeStaffGrants } from "../lib/scoped-grants";
import {
  assertNotOwnStaffEntry,
  assertStaffAssignableRole,
  assertWithinStaffPrivilegeCeiling,
} from "../lib/staff-entry-guards";

const tableByType = {
  admin: core_admin_permissions,
  moderator: core_moderators_permissions,
} as const;

export const updatePermissionsStaffAdminRoute = buildRoute({
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
      400: {
        content: {
          "application/json": {
            schema: z.object({
              error: z.string(),
              issues: z.array(staffGrantIssueSchema),
            }),
          },
        },
        description:
          "A scope is missing, malformed, names unknown resources, or is wider than its dependency's. The default and guest roles cannot be given staff access either",
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
      plugin: manifest.id,
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
        unrestricted: table.unrestricted,
        permissions: table.permissions,
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

    await assertNotOwnStaffEntry(
      c,
      entry,
      "You cannot edit your own staff permissions.",
    );

    if (entry.roleId != null) {
      await assertStaffAssignableRole(c, entry.roleId);
    }

    await assertWithinStaffPrivilegeCeiling(c, {
      type,
      current: {
        unrestricted: entry.unrestricted,
        permissions: entry.permissions,
      },
      requested: { unrestricted, permissions },
    });

    const sanitized: PermissionsStaffArgs[] = unrestricted
      ? []
      : await sanitizeStaffGrants(c, { permissions, type });

    const label = await staffEntryAuditLabel(c, entry);
    const updated = await c.get("db").transaction(async tx => {
      const [row] = await tx
        .update(table)
        .set({ unrestricted, permissions: sanitized })
        .where(eq(table.id, entryId))
        .returning({ id: table.id });
      if (!row) return null;

      // The grants that moved, never the whole list: what an auditor asks is
      // "who was given what, and by whom".
      const delta = staffGrantsAuditDelta(entry.permissions, sanitized);
      const changes = auditDiff({
        after: { unrestricted },
        before: { unrestricted: entry.unrestricted },
      });
      if (changes || delta.granted.length > 0 || delta.revoked.length > 0) {
        await writeAuditLog(
          c,
          {
            action: `${type}_permissions.updated`,
            changes,
            metadata: {
              ...delta,
              ...(entry.roleId === null
                ? { userId: entry.userId }
                : { roleId: entry.roleId }),
            },
            target: { id: entryId, label, type: "staff_entry" },
          },
          tx,
        );
      }

      return row;
    });

    if (!updated) {
      return c.json({ error: "Staff entry not found" }, 404);
    }

    await invalidateStaffEntry(c, entry);

    return c.json({ unrestricted, permissions: sanitized }, 200);
  },
});
