import { eq } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { core_ai_role_permissions, core_ai_role_policies } from "@/database/ai";
import { core_roles } from "@/database/roles";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import { decimalOrNull } from "../lib/decimal-or-null";

export const getAiRoleAccessAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.ai.canView,
  route: {
    method: "get",
    description:
      "The AI permissions a role can grant and, for an existing role, its allowance and grants.",
    path: "/access/roles",
    request: {
      query: z.object({ roleId: z.coerce.number().int().optional() }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              permissions: z.array(
                z.object({
                  actions: z.array(
                    z.object({
                      description: z.string(),
                      icon: z.string().nullable(),
                      key: z.string(),
                      title: z.string(),
                    }),
                  ),
                  defaultGranted: z.boolean(),
                  key: z.string(),
                }),
              ),
              role: z
                .object({
                  grants: z.array(
                    z.object({
                      dailyLimit: z.number().nullable(),
                      granted: z.boolean(),
                      permission: z.string(),
                    }),
                  ),
                  monthlyPoints: z.string().nullable(),
                  root: z.boolean(),
                  unlimited: z.boolean(),
                })
                .nullable(),
            }),
          },
        },
        description: "AI access of a role",
      },
    },
  },
  handler: async c => {
    const { roleId } = c.req.valid("query");
    const db = c.get("db");

    const permissions = new Map<
      string,
      {
        actions: {
          description: string;
          icon: null | string;
          key: string;
          title: string;
        }[];
        defaultGranted: boolean;
      }
    >();
    for (const action of c.get("ai").actions().all()) {
      if (!action.definition.actors.includes("user")) continue;
      const entry = permissions.get(action.permissionKey) ?? {
        actions: [],
        defaultGranted: action.definition.permission.defaultGranted,
      };
      entry.actions.push({
        description: action.definition.description,
        icon: action.definition.icon ?? null,
        key: action.key,
        title: action.definition.title,
      });
      permissions.set(action.permissionKey, entry);
    }

    let role: null | {
      grants: {
        dailyLimit: null | number;
        granted: boolean;
        permission: string;
      }[];
      monthlyPoints: null | string;
      root: boolean;
      unlimited: boolean;
    } = null;
    if (roleId !== undefined) {
      const [[row], [policy], grants] = await Promise.all([
        db
          .select({ root: core_roles.root })
          .from(core_roles)
          .where(eq(core_roles.id, roleId)),
        db
          .select()
          .from(core_ai_role_policies)
          .where(eq(core_ai_role_policies.roleId, roleId)),
        db
          .select()
          .from(core_ai_role_permissions)
          .where(eq(core_ai_role_permissions.roleId, roleId)),
      ]);
      if (row) {
        role = {
          grants: grants.map(grant => ({
            dailyLimit: grant.dailyLimit,
            granted: grant.granted,
            permission: grant.permission,
          })),
          monthlyPoints: decimalOrNull(policy?.monthlyPoints),
          root: row.root,
          unlimited: policy?.unlimited ?? false,
        };
      }
    }

    return c.json(
      {
        permissions: [...permissions.entries()].map(([key, value]) => ({
          key,
          ...value,
        })),
        role,
      },
      200,
    );
  },
});
