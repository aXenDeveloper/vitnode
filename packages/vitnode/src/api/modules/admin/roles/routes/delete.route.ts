import { z } from "@hono/zod-openapi";
import { and, count, eq, inArray } from "drizzle-orm";

import { buildRoute } from "@/api/lib/route";
import { assertCanAssignPrimaryRole } from "@/api/modules/admin/users/lib/assert-edit-user-permission";
import { CONFIG_PLUGIN } from "@/config";
import { core_languages_words } from "@/database/languages";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";

import { assertCanManageAdminRole } from "../lib/assert-manage-admin-role";

export const deleteRoleAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "roles", permission: "can_delete" },
  route: {
    method: "delete",
    description: "Delete a role by id (Admin only)",
    path: "/{id}",
    request: {
      params: z.object({
        id: z.string().openapi({ example: "1" }),
      }),
      query: z.object({
        // When the role still has members, they must be reassigned to this
        // role before it can be removed (see the handler for why).
        moveToRoleId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: "Role deleted",
      },
      400: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Role still has members or an invalid target was given",
      },
      403: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Role cannot be deleted",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Role not found",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const { moveToRoleId } = c.req.valid("query");
    const db = c.get("db");

    const roleId = Number(id);
    if (!Number.isInteger(roleId)) {
      return c.json({ error: "Role not found" }, 404);
    }

    const [role] = await db
      .select({
        id: core_roles.id,
        protected: core_roles.protected,
        default: core_roles.default,
        root: core_roles.root,
        guest: core_roles.guest,
      })
      .from(core_roles)
      .where(eq(core_roles.id, roleId))
      .limit(1);

    if (!role) {
      return c.json({ error: "Role not found" }, 404);
    }

    // System roles are managed by the platform (root/guest access, the default
    // role for new sign-ups) and must always exist.
    if (role.protected || role.default || role.root || role.guest) {
      return c.json({ error: "This role cannot be deleted" }, 403);
    }

    // Deleting a role that grants admin access requires the elevated permission.
    await assertCanManageAdminRole(c, {
      roleId,
      permission: "can_delete_admin",
    });

    // Members point at their primary role through a NOT NULL, RESTRICT foreign
    // key, so anyone in this role has to be moved elsewhere first. Secondary
    // roles and staff permission entries reference the role with ON DELETE
    // CASCADE, so those clean themselves up.
    const [{ total: usersCount }] = await db
      .select({ total: count() })
      .from(core_users)
      .where(eq(core_users.roleId, roleId));

    let targetRoleId: null | number = null;
    if (usersCount > 0) {
      if (moveToRoleId === undefined) {
        return c.json({ error: "Role has assigned users" }, 400);
      }

      targetRoleId = Number(moveToRoleId);
      if (!Number.isInteger(targetRoleId) || targetRoleId === roleId) {
        return c.json({ error: "Invalid target role" }, 400);
      }

      const [target] = await db
        .select({ id: core_roles.id, guest: core_roles.guest })
        .from(core_roles)
        .where(eq(core_roles.id, targetRoleId))
        .limit(1);

      // The guest role can never be a user's primary role, so it is not a valid
      // move target.
      if (!target || target.guest) {
        return c.json({ error: "Invalid target role" }, 400);
      }

      // Moving members into an admin-granting role would make them admins, so
      // it needs the same permission as promoting a user to admin - a
      // `can_edit`-only admin must not be able to escalate members this way.
      await assertCanAssignPrimaryRole(c, targetRoleId);
    }

    await db.transaction(async tx => {
      if (targetRoleId != null) {
        // Grab the members before the move so we can drop any secondary-role
        // rows that would collide with their new primary role.
        const members = await tx
          .select({ id: core_users.id })
          .from(core_users)
          .where(eq(core_users.roleId, roleId));
        const memberIds = members.map(member => member.id);

        await tx
          .update(core_users)
          .set({ roleId: targetRoleId })
          .where(eq(core_users.roleId, roleId));

        // A role cannot sit in both the primary and secondary slot for the same
        // user, so remove the now-duplicate secondary entries.
        if (memberIds.length > 0) {
          await tx
            .delete(core_users_secondary_roles)
            .where(
              and(
                eq(core_users_secondary_roles.roleId, targetRoleId),
                inArray(core_users_secondary_roles.userId, memberIds),
              ),
            );
        }
      }

      // Role names live in `core_languages_words`, so remove them here to avoid
      // leaving orphaned translations behind.
      await tx
        .delete(core_languages_words)
        .where(
          and(
            eq(core_languages_words.pluginCode, "core"),
            eq(core_languages_words.tableName, "core_roles"),
            eq(core_languages_words.variable, "name"),
            eq(core_languages_words.itemId, roleId),
          ),
        );

      await tx.delete(core_roles).where(eq(core_roles.id, roleId));
    });

    await c.get("events").emit("role.deleted", { roleId });

    return c.body(null, 200);
  },
});
