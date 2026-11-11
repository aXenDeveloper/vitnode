import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { coreStaffPermissions } from "@/lib/core-staff-permissions";

const { admin } = coreStaffPermissions;

export const ADMIN_USER_PERMISSIONS = {
  create: admin.users.canCreate,
  edit: admin.users.canEdit,
  editAdmin: admin.users.canEditAdmin,
  view: admin.users.canView,
  viewHiddenPresence: admin.users.canViewHiddenPresence,
} as const;

export const ADMIN_DEBUG_PERMISSIONS = {
  ai: admin.ai.canView,
  clearCache: admin.debug.canClearCache,
  cron: admin.cron.canView,
  plugins: admin.plugins.canView,
  queue: admin.queue.canView,
  system: admin.system.canView,
  testAi: admin.system.canTestAi,
  testEmail: admin.system.canSendTestEmail,
  testStorage: admin.system.canTestStorage,
  view: admin.debug.canView,
} as const;

export const ADMIN_SEARCH_PERMISSIONS = {
  manage: admin.system.canManageSearch,
} as const;

export const ADMIN_ROLE_PERMISSIONS = {
  create: admin.roles.canCreate,
  delete: admin.roles.canDelete,
  deleteAdmin: admin.roles.canDeleteAdmin,
  edit: admin.roles.canEdit,
  editAdmin: admin.roles.canEditAdmin,
  view: admin.roles.canView,
} as const;

export const ADMIN_REPORT_REASON_PERMISSIONS = {
  create: admin.report_reasons.canCreate,
  delete: admin.report_reasons.canDelete,
  edit: admin.report_reasons.canEdit,
  view: admin.report_reasons.canView,
} as const;

export const ADMIN_WARNING_PERMISSIONS = {
  manage: admin.warning_settings.canManage,
  view: admin.warning_settings.canView,
} as const;

export const staffPermissionModuleFor = (
  type: PermissionStaffType,
): "staff_admins" | "staff_moderators" =>
  type === "admin" ? "staff_admins" : "staff_moderators";

/** The permissions that manage the admin or the moderator staff list. */
export const adminStaffPermissions = (type: PermissionStaffType) => {
  const permissions = admin[staffPermissionModuleFor(type)];

  return {
    create: permissions.canCreate,
    delete: permissions.canDelete,
    edit: permissions.canEdit,
    view: permissions.canView,
  } as const;
};
