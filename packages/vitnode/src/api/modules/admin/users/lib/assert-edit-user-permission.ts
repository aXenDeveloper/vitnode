import type { Context } from "hono";

import { and, eq, inArray } from "drizzle-orm";

import { assertStaffPermission } from "@/api/lib/check-staff-permission";
import { SessionAdminModel } from "@/api/models/session-admin";
import { CONFIG_PLUGIN } from "@/config";
import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";

const assertCanEditAdmin = async (c: Context): Promise<void> => {
  await assertStaffPermission(c, {
    type: "admin",
    plugin: CONFIG_PLUGIN.pluginId,
    module: "users",
    permission: "can_edit_admin",
  });
};

export const assertCanEditAdminTarget = async (
  c: Context,
  userId: number,
): Promise<void> => {
  const isTargetAdmin = await new SessionAdminModel(c).checkIfUserIsAdmin(
    userId,
  );
  if (!isTargetAdmin) return;

  await assertCanEditAdmin(c);
};

/**
 * Whether granting any of these roles hands the holder staff powers.
 *
 * Three ways a role can, and all three have to be asked about together:
 *
 * - a row in `core_admin_permissions` - what `checkIfUserIsAdmin` reads, so the
 *   role opens the AdminCP;
 * - a row in `core_moderators_permissions` - the moderator half of the same
 *   thing, `unrestricted` on the seeded Moderator role;
 * - `core_roles.root` - which `loadStaffPermissions` short-circuits on to return
 *   *every* permission, whether or not a staff row exists. Checked in its own
 *   right rather than assumed to imply the first, because a role granting
 *   everything is exactly the one not to miss on an install whose rows were
 *   built by hand.
 */
const rolesGrantStaffAccess = async (
  c: Context,
  roleIds: number[],
): Promise<boolean> => {
  if (roleIds.length === 0) return false;

  const db = c.get("db");

  const [rootRoles, adminRoles, moderatorRoles] = await Promise.all([
    db
      .select({ id: core_roles.id })
      .from(core_roles)
      .where(and(inArray(core_roles.id, roleIds), eq(core_roles.root, true)))
      .limit(1),
    db
      .select({ id: core_admin_permissions.id })
      .from(core_admin_permissions)
      .where(inArray(core_admin_permissions.roleId, roleIds))
      .limit(1),
    db
      .select({ id: core_moderators_permissions.id })
      .from(core_moderators_permissions)
      .where(inArray(core_moderators_permissions.roleId, roleIds))
      .limit(1),
  ]);

  return (
    rootRoles.length > 0 || adminRoles.length > 0 || moderatorRoles.length > 0
  );
};

/**
 * Refuses to attach a staff-granting role unless the caller holds
 * `users:can_edit_admin`.
 *
 * ## Why every role, not just the primary one
 *
 * `loadStaffPermissions` resolves a user's powers from `getUserRoleIds`, which
 * is the primary role **plus every secondary role**. A secondary role therefore
 * grants exactly what a primary one does - up to and including `root`, which
 * short-circuits the whole permission check to "yes".
 *
 * This guard used to run on `body.roleId` alone, so the secondary list walked
 * straight past it. An administrator holding only `users:can_edit` could
 * `PATCH /admin/users/{their own id}` with `secondaryRoleIds: [<root role>]`
 * and come back as root - the escalation the primary-role check was written to
 * prevent, reached by the field beside it. Both lists are checked here now, so
 * there is no "the other one" left to find.
 */
export const assertCanAssignRoles = async (
  c: Context,
  roleIds: number[],
): Promise<void> => {
  const unique = [...new Set(roleIds)];
  if (!(await rolesGrantStaffAccess(c, unique))) return;

  await assertCanEditAdmin(c);
};

/** {@link assertCanAssignRoles} for a single role. */
export const assertCanAssignPrimaryRole = async (
  c: Context,
  roleId: number,
): Promise<void> => {
  await assertCanAssignRoles(c, [roleId]);
};
