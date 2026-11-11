import { coreStaffPermissions } from "@/lib/core-staff-permissions";

export const ADMIN_AI_PERMISSIONS = {
  manage: coreStaffPermissions.admin.ai.canManage,
  view: coreStaffPermissions.admin.ai.canView,
} as const;
