import type { Context } from "hono";

import { AUDIT_CORE_PLUGIN_ID } from "../../../lib/audit/const";
import { checkStaffPermission } from "../check-staff-permission";

/** The staff permission module of the Activity Logs. */
export const AUDIT_PERMISSION_MODULE = "activity_logs";

export const AUDIT_PERMISSIONS = {
  export: "can_export",
  manageRetention: "can_manage_retention",
  view: "can_view",
  viewSensitive: "can_view_sensitive",
} as const;

/** Whether the AdminCP admin holds one Activity Logs permission. */
export const canAdminAudit = async (
  c: Context,
  permission: (typeof AUDIT_PERMISSIONS)[keyof typeof AUDIT_PERMISSIONS],
): Promise<boolean> =>
  await checkStaffPermission(c, {
    module: AUDIT_PERMISSION_MODULE,
    permission,
    plugin: AUDIT_CORE_PLUGIN_ID,
    type: "admin",
  });
