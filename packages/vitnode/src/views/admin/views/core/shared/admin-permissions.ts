import type {
  PermissionsStaffArgs,
  PermissionStaffType,
} from "@/api/lib/permission-staff";

import { manifest } from "@/manifest";

/** A core permission tuple. The plugin is always `@vitnode/core` here. */
const core = (module: string, permission: string): PermissionsStaffArgs => ({
  module,
  permission,
  plugin: manifest.id,
});

export const ADMIN_USER_PERMISSIONS = {
  create: core("users", "can_create"),
  edit: core("users", "can_edit"),
  editAdmin: core("users", "can_edit_admin"),
  view: core("users", "can_view"),
  viewHiddenPresence: core("users", "can_view_hidden_presence"),
} as const;

export const ADMIN_DEBUG_PERMISSIONS = {
  ai: core("ai", "can_view"),
  clearCache: core("debug", "can_clear_cache"),
  cron: core("cron", "can_view"),
  plugins: core("plugins", "can_view"),
  queue: core("queue", "can_view"),
  system: core("system", "can_view"),
  testAi: core("system", "can_test_ai"),
  testEmail: core("system", "can_send_test_email"),
  testStorage: core("system", "can_test_storage"),
  view: core("debug", "can_view"),
} as const;

export const ADMIN_SEARCH_PERMISSIONS = {
  manage: core("system", "can_manage_search"),
} as const;

export const ADMIN_ROLE_PERMISSIONS = {
  create: core("roles", "can_create"),
  delete: core("roles", "can_delete"),
  deleteAdmin: core("roles", "can_delete_admin"),
  edit: core("roles", "can_edit"),
  editAdmin: core("roles", "can_edit_admin"),
  view: core("roles", "can_view"),
} as const;

export const ADMIN_REPORT_REASON_PERMISSIONS = {
  create: core("report_reasons", "can_create"),
  delete: core("report_reasons", "can_delete"),
  edit: core("report_reasons", "can_edit"),
  view: core("report_reasons", "can_view"),
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
