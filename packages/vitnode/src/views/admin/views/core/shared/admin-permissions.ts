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

export const ADMIN_USER_PERMISSIONS = {
  create: core("users", "can_create"),
  edit: core("users", "can_edit"),
  editAdmin: core("users", "can_edit_admin"),
  view: core("users", "can_view"),
} as const;

export const ADMIN_ROLE_PERMISSIONS = {
  create: core("roles", "can_create"),
  delete: core("roles", "can_delete"),
  deleteAdmin: core("roles", "can_delete_admin"),
  edit: core("roles", "can_edit"),
  editAdmin: core("roles", "can_edit_admin"),
  view: core("roles", "can_view"),
} as const;

export const staffPermissionModuleFor = (
  type: PermissionStaffType,
): "staff_admins" | "staff_moderators" =>
  type === "admin" ? "staff_admins" : "staff_moderators";

export const adminStaffPermissions = (type: PermissionStaffType) => {
  const module = staffPermissionModuleFor(type);

  return {
    create: core(module, "can_create"),
    delete: core(module, "can_delete"),
    edit: core(module, "can_edit"),
    view: core(module, "can_view"),
  } as const;
};
