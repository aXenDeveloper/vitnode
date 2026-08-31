/**
 * Every staff permission the AdminCP's users, roles and staff screens check,
 * written down once.
 *
 * These are not new rules. Each tuple already exists twice - as an
 * `adminStaffPermission` on the Hono route that enforces it, and as an
 * `<AdminStaffPermissionGate>` or an `<AdminPermissionRequired>` in the Next.js
 * page that hides the control. Writing them a third time, inline, per framework,
 * is how a button ends up shown to somebody the API refuses, or hidden from
 * somebody it would allow.
 *
 * So they live here, beside the queries they gate, and the Next.js pages, the
 * TanStack loaders and the shared components all read the same objects.
 * `admin-permission-parity.test.ts` holds them to the API's own declarations.
 *
 * ## What they are not
 *
 * Not the boundary. `api/config.ts` puts `globalAdminMiddleware()` in front of
 * every request whose path contains `/admin/`, each handler re-checks the staff
 * tables, and `SessionAdminModel.getUser()` re-runs `checkIfUserIsAdmin` on
 * every request. These decide what to *render*.
 */

import type {
  PermissionsStaffArgs,
  PermissionStaffType,
} from "@/api/lib/permission-staff";

import { CONFIG_PLUGIN } from "@/config";

/** A core permission tuple. The plugin is always `@vitnode/core` here. */
const core = (module: string, permission: string): PermissionsStaffArgs => ({
  module,
  permission,
  plugin: CONFIG_PLUGIN.pluginId,
});

/**
 * The users list and the user page.
 *
 *     view        the list, the detail page, and both API reads
 *     create      the create dialog, and `POST /admin/users/create`
 *     edit        the row actions, the in-place editors, and every write
 *     editAdmin   additionally, when the *target* is an administrator
 */
export const ADMIN_USER_PERMISSIONS = {
  create: core("users", "can_create"),
  edit: core("users", "can_edit"),
  editAdmin: core("users", "can_edit_admin"),
  view: core("users", "can_view"),
} as const;

/**
 * The roles list.
 *
 * `view` is a *frontend* gate and only that: `listRolesAdminRoute` declares no
 * `adminStaffPermission`, deliberately, because a role *picker* has to work for
 * an administrator who cannot open the roles *screen*. The other five are on the
 * API as well.
 *
 * `editAdmin` and `deleteAdmin` are the elevated pair, required on top of the
 * ordinary one when the role grants administrator access.
 */
export const ADMIN_ROLE_PERMISSIONS = {
  create: core("roles", "can_create"),
  delete: core("roles", "can_delete"),
  deleteAdmin: core("roles", "can_delete_admin"),
  edit: core("roles", "can_edit"),
  editAdmin: core("roles", "can_edit_admin"),
  view: core("roles", "can_view"),
} as const;

/**
 * Which permission module governs one staff group.
 *
 * `staffPermissionModuleByType` on the API, restated: that module lives under
 * `api/modules/**` and importing it would pull zod-openapi and the route tree
 * into a browser bundle. The two are a pair, and
 * `staff-permission-parity.test.ts` is what keeps them one.
 */
export const staffPermissionModuleFor = (
  type: PermissionStaffType,
): "staff_admins" | "staff_moderators" =>
  type === "admin" ? "staff_admins" : "staff_moderators";

/**
 * The four permissions that govern a staff group, for whichever group it is.
 *
 * A function rather than two constants because the two groups differ only in
 * their module, and a table with both spelled out is a table two edits can
 * disagree in.
 */
export const adminStaffPermissions = (type: PermissionStaffType) => {
  const module = staffPermissionModuleFor(type);

  return {
    create: core(module, "can_create"),
    delete: core(module, "can_delete"),
    edit: core(module, "can_edit"),
    view: core(module, "can_view"),
  } as const;
};
