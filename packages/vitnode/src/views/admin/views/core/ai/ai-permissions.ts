import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { manifest } from "@/manifest";

const ai = (permission: string): PermissionsStaffArgs => ({
  module: "ai",
  permission,
  plugin: manifest.id,
});

export const ADMIN_AI_PERMISSIONS = {
  manage: ai("can_manage"),
  view: ai("can_view"),
} as const;
