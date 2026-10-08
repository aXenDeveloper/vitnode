import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { formatDecimal, parseDecimal } from "@/api/lib/ai/decimal";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import {
  core_ai_role_permissions,
  core_ai_role_policies,
  core_ai_user_overrides,
} from "@/database/ai";
import { core_roles } from "@/database/roles";

import { zodDecimalString } from "../schemas";

const decimalOrNull = (value: null | string | undefined) =>
  value === null || value === undefined
    ? null
    : formatDecimal(parseDecimal(value));

export const getAiRoleAccessAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_view" },
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

export const getAiUserOverrideAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_view" },
  route: {
    method: "get",
    description: "One user's AI exception, or null when their roles apply.",
    path: "/access/users/{userId}",
    request: { params: z.object({ userId: z.coerce.number().int() }) },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              override: z
                .object({
                  blocked: z.boolean(),
                  monthlyPoints: z.string().nullable(),
                  unlimited: z.boolean(),
                })
                .nullable(),
            }),
          },
        },
        description: "AI exception of a user",
      },
    },
  },
  handler: async c => {
    const { userId } = c.req.valid("param");
    const [row] = await c
      .get("db")
      .select()
      .from(core_ai_user_overrides)
      .where(eq(core_ai_user_overrides.userId, userId));

    return c.json(
      {
        override: row
          ? {
              blocked: row.blocked,
              monthlyPoints: decimalOrNull(row.monthlyPoints),
              unlimited: row.unlimited,
            }
          : null,
      },
      200,
    );
  },
});

export const updateAiRoleAccessAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_manage" },
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
    });

    return c.json({ ok: true as const }, 200);
  },
});

export const updateAiUserOverrideAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_manage" },
  route: {
    method: "put",
    description:
      "Give one user an explicit AI exception: a different allowance, unlimited, or blocked.",
    path: "/access/users",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              blocked: z.boolean(),
              monthlyPoints: zodDecimalString.nullable(),
              unlimited: z.boolean(),
              userId: z.number().int(),
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
    const { userId, ...values } = c.req.valid("json");
    await c
      .get("db")
      .insert(core_ai_user_overrides)
      .values({ userId, ...values })
      .onConflictDoUpdate({
        set: values,
        target: core_ai_user_overrides.userId,
      });

    return c.json({ ok: true as const }, 200);
  },
});

export const deleteAiUserOverrideAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_manage" },
  route: {
    method: "delete",
    description: "Remove a user's AI exception; their roles apply again.",
    path: "/access/users",
    request: { query: z.object({ userId: z.coerce.number().int() }) },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.literal(true) }) },
        },
        description: "Removed",
      },
    },
  },
  handler: async c => {
    const { userId } = c.req.valid("query");
    await c
      .get("db")
      .delete(core_ai_user_overrides)
      .where(eq(core_ai_user_overrides.userId, userId));

    return c.json({ ok: true as const }, 200);
  },
});
