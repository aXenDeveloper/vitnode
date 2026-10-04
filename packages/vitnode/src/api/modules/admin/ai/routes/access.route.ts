import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { formatDecimal, parseDecimal } from "@/api/lib/ai/decimal";
import { resolveRoleNames } from "@/api/lib/resolve-role-names";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import {
  core_ai_role_permissions,
  core_ai_role_policies,
  core_ai_user_overrides,
} from "@/database/ai";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";

const zodRoleName = z.array(
  z.object({ languageCode: z.string(), name: z.string() }),
);

export const getAiAccessAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Who may use which AI feature: role grants, allowances and user exceptions.",
    path: "/access",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              overrides: z.array(
                z.object({
                  blocked: z.boolean(),
                  monthlyPoints: z.string().nullable(),
                  unlimited: z.boolean(),
                  user: z.object({
                    id: z.number(),
                    name: z.string(),
                    nameCode: z.string(),
                  }),
                }),
              ),
              permissions: z.array(
                z.object({
                  actions: z.array(z.string()),
                  defaultGranted: z.boolean(),
                  key: z.string(),
                }),
              ),
              roles: z.array(
                z.object({
                  grants: z.array(
                    z.object({
                      dailyLimit: z.number().nullable(),
                      granted: z.boolean(),
                      permission: z.string(),
                    }),
                  ),
                  id: z.number(),
                  monthlyPoints: z.string().nullable(),
                  name: zodRoleName,
                  root: z.boolean(),
                  unlimited: z.boolean(),
                }),
              ),
            }),
          },
        },
        description: "AI access",
      },
    },
  },
  handler: async c => {
    const db = c.get("db");
    const [roles, policies, grants, overrides] = await Promise.all([
      db
        .select({ id: core_roles.id, root: core_roles.root })
        .from(core_roles)
        .where(eq(core_roles.guest, false))
        .orderBy(asc(core_roles.id)),
      db.select().from(core_ai_role_policies),
      db.select().from(core_ai_role_permissions),
      db
        .select({
          blocked: core_ai_user_overrides.blocked,
          id: core_users.id,
          monthlyPoints: core_ai_user_overrides.monthlyPoints,
          name: core_users.name,
          nameCode: core_users.nameCode,
          unlimited: core_ai_user_overrides.unlimited,
        })
        .from(core_ai_user_overrides)
        .innerJoin(core_users, eq(core_users.id, core_ai_user_overrides.userId))
        .orderBy(asc(core_users.name)),
    ]);
    const names = await resolveRoleNames(
      c,
      roles.map(role => role.id),
    );

    const permissions = new Map<
      string,
      { actions: string[]; defaultGranted: boolean }
    >();
    for (const action of c.get("ai").actions().all()) {
      if (!action.definition.actors.includes("user")) continue;
      const entry = permissions.get(action.permissionKey) ?? {
        actions: [],
        defaultGranted: action.definition.permission.defaultGranted,
      };
      entry.actions.push(action.key);
      permissions.set(action.permissionKey, entry);
    }

    return c.json(
      {
        overrides: overrides.map(row => ({
          blocked: row.blocked,
          monthlyPoints:
            row.monthlyPoints === null
              ? null
              : formatDecimal(parseDecimal(row.monthlyPoints)),
          unlimited: row.unlimited,
          user: { id: row.id, name: row.name, nameCode: row.nameCode },
        })),
        permissions: [...permissions.entries()].map(([key, value]) => ({
          key,
          ...value,
        })),
        roles: roles.map(role => {
          const policy = policies.find(row => row.roleId === role.id);

          return {
            grants: grants
              .filter(row => row.roleId === role.id)
              .map(row => ({
                dailyLimit: row.dailyLimit,
                granted: row.granted,
                permission: row.permission,
              })),
            id: role.id,
            monthlyPoints:
              policy?.monthlyPoints === null ||
              policy?.monthlyPoints === undefined
                ? null
                : formatDecimal(parseDecimal(policy.monthlyPoints)),
            name: names.get(role.id) ?? [],
            root: role.root,
            unlimited: policy?.unlimited ?? false,
          };
        }),
      },
      200,
    );
  },
});

const zodDecimal = z.string().regex(/^\d+(\.\d{1,12})?$/);

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
              monthlyPoints: zodDecimal.nullable(),
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
              monthlyPoints: zodDecimal.nullable(),
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
