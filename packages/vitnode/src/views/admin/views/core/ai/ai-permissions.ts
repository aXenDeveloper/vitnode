import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { CONFIG_PLUGIN } from "@/config";

const ai = (permission: string): PermissionsStaffArgs => ({
  module: "ai",
  permission,
  plugin: CONFIG_PLUGIN.pluginId,
});

export const ADMIN_AI_PERMISSIONS = {
  manage: ai("can_manage"),
  view: ai("can_view"),
} as const;
