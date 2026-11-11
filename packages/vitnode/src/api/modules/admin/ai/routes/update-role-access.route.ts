import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { roleAuditLabel } from "@/api/lib/audit/labels";
import { writeAuditLog } from "@/api/lib/audit/write";
import { core_ai_role_permissions, core_ai_role_policies } from "@/database/ai";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import { zodDecimalString } from "../ai.schema";

export const updateAiRoleAccessAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.ai.canManage,
  route: {
    method: "put",
    description:
      "Set one role's AI allowance and which AI permissions it grants. A `granted` of null removes the row, so the action's default applies.",
    path: "/access/roles",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              grants: z.array(
                z.object({
                  dailyLimit: z.number().int().min(0).max(100_000).nullable(),
                  granted: z.boolean().nullable(),
                  permission: z.string().min(3).max(255),
                }),
              ),
              monthlyPoints: zodDecimalString.nullable(),
              roleId: z.number().int(),
              unlimited: z.boolean(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.literal(true) }) },
        },
        description: "Saved",
      },
    },
  },
  handler: async c => {
    const { grants, monthlyPoints, roleId, unlimited } = c.req.valid("json");
    await c.get("db").transaction(async tx => {
      await tx
        .insert(core_ai_role_policies)
        .values({ monthlyPoints, roleId, unlimited })
        .onConflictDoUpdate({
          set: { monthlyPoints, unlimited },
          target: core_ai_role_policies.roleId,
        });

      const removed = grants
        .filter(grant => grant.granted === null)
        .map(grant => grant.permission);
      if (removed.length > 0) {
        await tx
          .delete(core_ai_role_permissions)
          .where(
            and(
              inArray(core_ai_role_permissions.permission, removed),
              eq(core_ai_role_permissions.roleId, roleId),
            ),
          );
      }
      for (const grant of grants) {
        if (grant.granted === null) continue;
        await tx
          .insert(core_ai_role_permissions)
          .values({
            dailyLimit: grant.dailyLimit,
            granted: grant.granted,
            permission: grant.permission,
            roleId,
          })
          .onConflictDoUpdate({
            set: { dailyLimit: grant.dailyLimit, granted: grant.granted },
            target: [
              core_ai_role_permissions.roleId,
              core_ai_role_permissions.permission,
            ],
          });
      }

      await writeAuditLog(
        c,
        {
          action: "ai_access.role_updated",
          metadata: {
            grants: grants.map(grant => ({
              dailyLimit: grant.dailyLimit,
              granted: grant.granted,
              permission: grant.permission,
            })),
            monthlyPoints,
            unlimited,
          },
          target: {
            id: roleId,
            label: await roleAuditLabel(c, roleId),
            type: "role",
          },
        },
        tx,
      );
    });

    return c.json({ ok: true as const }, 200);
  },
});
