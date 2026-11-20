import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import type { ContentDatabase } from "@/content/server/service";

import { buildRoute } from "@/builders";
import { core_roles } from "@/database/roles";
import { roleUpdatedEvent } from "@/events/roles";
import { auditDiff } from "@/lib/audit/diff";
import { roleAuditLabel } from "@/lib/audit/labels";
import { writeAuditLog } from "@/lib/audit/write";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { forgetReactionCatalog } from "@/lib/reactions/catalog";
import { REACTIONS_LIMITS } from "@/lib/reactions/const";
import { json } from "@/modules/reactions/reactions.schema";

import { dailyLimitSchema, errorSchema } from "../reactions.schema";

const roleParams = z.object({
  roleId: z.coerce.number().int().positive().openapi({ example: 2 }),
});

/** `0` reads the defaults a new role starts with. */
const showParams = z.object({
  roleId: z.coerce.number().int().min(0).openapi({ example: 2 }),
});

const perItemSchema = z
  .number()
  .int()
  .min(1)
  .max(REACTIONS_LIMITS.maxPerItem)
  .nullable();

const roleReactionSettingsSchema = z.object({
  allowReact: z.boolean(),
  allowReactOwnContent: z.boolean(),
  /** Different reactions a member gives one item; `null` = unlimited. */
  maxReactionsPerItem: perItemSchema,
  /** Reactions per day over every reaction; `null` = unlimited. */
  reactionsPerDay: dailyLimitSchema,
});

const NEW_ROLE_SETTINGS = {
  allowReact: true,
  allowReactOwnContent: true,
  maxReactionsPerItem: 1,
  reactionsPerDay: null,
};

const readSettings = async (db: ContentDatabase, roleId: number) => {
  const [role] = await db
    .select({
      allowReact: core_roles.allowReact,
      allowReactOwnContent: core_roles.allowReactOwnContent,
      maxReactionsPerItem: core_roles.maxReactionsPerItem,
      reactionsPerDay: core_roles.reactionsPerDay,
    })
    .from(core_roles)
    .where(eq(core_roles.id, roleId))
    .limit(1);
  return role ?? null;
};

export const showRoleReactionsAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.roles.canView,
  route: {
    method: "get",
    path: "/roles/{roleId}",
    description:
      "A role's reaction settings: whether it can react, to its own content too, reactions per item and the daily total. Which reactions it can use, and each one's daily limit, are set on the reaction (Admin only)",
    request: { params: showParams },
    responses: {
      200: json(roleReactionSettingsSchema, "Role reaction settings"),
      403: { description: "Access Denied" },
      404: json(errorSchema, "Role not found"),
    },
  },
  handler: async c => {
    const { roleId } = c.req.valid("param");
    const settings =
      roleId === 0
        ? NEW_ROLE_SETTINGS
        : await readSettings(c.get("db"), roleId);
    if (!settings) return c.json({ error: "not_found" }, 404);

    return c.json(settings, 200);
  },
});

export const updateRoleReactionsAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.roles.canEdit,
  route: {
    method: "put",
    path: "/roles/{roleId}",
    description:
      "Save a role's reaction settings: whether it can react, to its own content too, reactions per item and the daily total (Admin only)",
    request: {
      params: roleParams,
      body: {
        required: true,
        content: {
          "application/json": { schema: roleReactionSettingsSchema },
        },
      },
    },
    responses: {
      200: json(roleReactionSettingsSchema, "Saved settings"),
      403: { description: "Access Denied" },
      404: json(errorSchema, "Role not found"),
    },
  },
  handler: async c => {
    const { roleId } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");
    const before = await readSettings(db, roleId);
    if (!before) return c.json({ error: "not_found" }, 404);

    await db.transaction(async tx => {
      await tx
        .update(core_roles)
        .set({
          allowReact: body.allowReact,
          allowReactOwnContent: body.allowReactOwnContent,
          maxReactionsPerItem: body.maxReactionsPerItem,
          reactionsPerDay: body.reactionsPerDay,
          updatedAt: new Date(),
        })
        .where(eq(core_roles.id, roleId));

      const changes = auditDiff({
        after: {
          allowReact: body.allowReact,
          allowReactOwnContent: body.allowReactOwnContent,
          maxReactionsPerItem: body.maxReactionsPerItem,
          reactionsPerDay: body.reactionsPerDay,
        },
        before: {
          allowReact: before.allowReact,
          allowReactOwnContent: before.allowReactOwnContent,
          maxReactionsPerItem: before.maxReactionsPerItem,
          reactionsPerDay: before.reactionsPerDay,
        },
      });
      await writeAuditLog(
        c,
        {
          action: "reaction.role_limits_updated",
          ...(changes ? { changes } : {}),
          target: {
            id: roleId,
            label: await roleAuditLabel(c, roleId),
            type: "role",
          },
        },
        tx,
      );
    });

    await forgetReactionCatalog(c);
    await c.get("events").emit(roleUpdatedEvent, { roleId });
    const saved = await readSettings(db, roleId);

    return c.json(saved ?? before, 200);
  },
});
