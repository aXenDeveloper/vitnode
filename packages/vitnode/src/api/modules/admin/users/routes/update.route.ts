import { z } from "@hono/zod-openapi";
import { and, eq, inArray, ne } from "drizzle-orm";

import { buildRoute } from "@/api/lib/route";
import { invalidateStaffPermissionsForUser } from "@/api/lib/staff-permission-cache";
import { invalidateSessionCacheForUser } from "@/api/models/session-revoke";
import { CONFIG_PLUGIN } from "@/config";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";

import {
  assertCanAssignRoles,
  assertCanEditAdminTarget,
} from "../lib/assert-edit-user-permission";

const nameRegex = /^(?!.* {2})[\p{L}\p{N}._@ -]*$/u;

export const zodUpdateUserAdminSchema = z
  .object({
    email: z.email().toLowerCase().openapi({
      example: "test@test.com",
    }),
    name: z
      .string()
      .min(3)
      .refine(val => nameRegex.test(val), {
        message: "Invalid name",
      })
      .openapi({ example: "test" }),
    nameCode: z
      .string()
      .min(3)
      .max(255)
      .regex(/^[a-zA-Z0-9-]+$/, { message: "Invalid name code" })
      .openapi({ example: "test" }),
    roleId: z.number().int().positive().openapi({ example: 1 }),
    secondaryRoleIds: z
      .array(z.number().int().positive())
      .openapi({ example: [2, 3] }),
  })
  .partial()
  .refine(body => Object.values(body).some(value => value !== undefined), {
    message: "At least one field is required",
  });

export const updateUserAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_edit" },
  route: {
    method: "patch",
    description: "Update a user's name or email by id (Admin only)",
    path: "/{id}",
    request: {
      params: z.object({
        id: z.string().openapi({ example: "1" }),
      }),
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodUpdateUserAdminSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              id: z.number(),
              name: z.string(),
              email: z.email(),
              nameCode: z.string(),
            }),
          },
        },
        description: "User updated",
      },
      400: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Invalid role",
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
        description: "User not found",
      },
      409: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Email or name already exists",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");

    const userId = Number(id);
    if (!Number.isInteger(userId)) {
      return c.json({ error: "User not found" }, 404);
    }

    const [user] = await db
      .select({ id: core_users.id, roleId: core_users.roleId })
      .from(core_users)
      .where(eq(core_users.id, userId))
      .limit(1);

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    await assertCanEditAdminTarget(c, userId);

    const values: Partial<typeof core_users.$inferInsert> = {};

    if (body.email !== undefined) {
      const [existing] = await db
        .select({ id: core_users.id })
        .from(core_users)
        .where(
          and(eq(core_users.email, body.email), ne(core_users.id, user.id)),
        )
        .limit(1);

      if (existing) {
        return c.json({ error: "Email already exists" }, 409);
      }

      values.email = body.email;
    }

    if (body.name !== undefined) {
      const [existing] = await db
        .select({ id: core_users.id })
        .from(core_users)
        .where(and(eq(core_users.name, body.name), ne(core_users.id, user.id)))
        .limit(1);

      if (existing) {
        return c.json({ error: "Name already exists" }, 409);
      }

      values.name = body.name;
    }

    if (body.nameCode !== undefined) {
      // The name code is the user's URL identifier (`@mention` handle), so it
      // must stay globally unique.
      const [existing] = await db
        .select({ id: core_users.id })
        .from(core_users)
        .where(
          and(
            eq(core_users.nameCode, body.nameCode),
            ne(core_users.id, user.id),
          ),
        )
        .limit(1);

      if (existing) {
        return c.json({ error: "Name code already exists" }, 409);
      }

      values.nameCode = body.nameCode;
    }

    const effectivePrimaryId = body.roleId ?? user.roleId;
    const secondaryRoleIds =
      body.secondaryRoleIds !== undefined
        ? [...new Set(body.secondaryRoleIds)].filter(
            id => id !== effectivePrimaryId,
          )
        : undefined;

    const roleIdsToValidate = [
      ...(body.roleId !== undefined ? [body.roleId] : []),
      ...(secondaryRoleIds ?? []),
    ];

    if (roleIdsToValidate.length > 0) {
      const existingRoles = await db
        .select({ id: core_roles.id, guest: core_roles.guest })
        .from(core_roles)
        .where(inArray(core_roles.id, roleIdsToValidate));
      const assignableRoleIds = new Set(
        existingRoles.filter(role => !role.guest).map(role => role.id),
      );

      if (roleIdsToValidate.some(id => !assignableRoleIds.has(id))) {
        return c.json({ error: "Invalid role" }, 400);
      }
    }

    // Every role being attached, in one check, before any of them is written.
    // Secondary roles carry the same weight as the primary one -
    // `loadStaffPermissions` reads them all - so guarding only `body.roleId`
    // left `secondaryRoleIds` as a way to hand out root without holding
    // `can_edit_admin`.
    if (roleIdsToValidate.length > 0) {
      await assertCanAssignRoles(c, roleIdsToValidate);
    }

    if (body.roleId !== undefined) {
      values.roleId = body.roleId;
    }

    if (secondaryRoleIds !== undefined) {
      await db
        .delete(core_users_secondary_roles)
        .where(eq(core_users_secondary_roles.userId, user.id));

      if (secondaryRoleIds.length > 0) {
        await db.insert(core_users_secondary_roles).values(
          secondaryRoleIds.map(roleId => ({
            userId: user.id,
            roleId,
          })),
        );
      }
    }

    // A role change moves which staff entries apply to this user, so their
    // cached permission set has to go. Only this user's - the roles themselves
    // are untouched, so everyone else's stays warm.
    const rolesChanged =
      body.roleId !== undefined || secondaryRoleIds !== undefined;

    if (Object.keys(values).length > 0) {
      const [updated] = await db
        .update(core_users)
        .set(values)
        .where(eq(core_users.id, user.id))
        .returning({
          id: core_users.id,
          name: core_users.name,
          email: core_users.email,
          nameCode: core_users.nameCode,
        });

      if (rolesChanged) {
        // Both caches, not just the permission one. `resolveStaffPermissions`
        // reads the primary role off the *cached user object*, so recomputing
        // from a stale `roleId` reaches the same answer it just discarded - and
        // a demotion applied here would not take effect for another minute.
        await Promise.all([
          invalidateStaffPermissionsForUser(c, user.id),
          invalidateSessionCacheForUser(c, user.id),
        ]);
      }

      await c.get("events").emit("user.updated", {
        userId: updated.id,
        email: updated.email,
        name: updated.name,
      });

      return c.json(updated, 200);
    }

    // No column change, but roles may still have been reassigned above.
    const [current] = await db
      .select({
        id: core_users.id,
        name: core_users.name,
        email: core_users.email,
        nameCode: core_users.nameCode,
      })
      .from(core_users)
      .where(eq(core_users.id, user.id))
      .limit(1);

    if (rolesChanged) {
      // The same pair as above - and this is the likelier path of the two, since
      // a request that changes only roles never reaches the `values` branch.
      await Promise.all([
        invalidateStaffPermissionsForUser(c, user.id),
        invalidateSessionCacheForUser(c, user.id),
      ]);
    }

    await c.get("events").emit("user.updated", {
      userId: current.id,
      email: current.email,
      name: current.name,
    });

    return c.json(current, 200);
  },
});
