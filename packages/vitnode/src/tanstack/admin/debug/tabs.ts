import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { ADMIN_DEBUG_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { DebugTab } from "./route-search";

import { DEBUG_TABS } from "./route-search";

export const DEBUG_TAB_PERMISSION: Record<DebugTab, PermissionsStaffArgs> = {
  ai: ADMIN_DEBUG_PERMISSIONS.ai,
  cache: ADMIN_DEBUG_PERMISSIONS.system,
  cron: ADMIN_DEBUG_PERMISSIONS.cron,
  logs: ADMIN_DEBUG_PERMISSIONS.view,
  overview: ADMIN_DEBUG_PERMISSIONS.view,
  plugins: ADMIN_DEBUG_PERMISSIONS.plugins,
  queue: ADMIN_DEBUG_PERMISSIONS.queue,
  search: ADMIN_DEBUG_PERMISSIONS.system,
  services: ADMIN_DEBUG_PERMISSIONS.system,
  vitnode: ADMIN_DEBUG_PERMISSIONS.plugins,
};

export const DEBUG_SYSTEM_TABS = [
  "vitnode",
  "plugins",
  "cron",
  "cache",
  "search",
  "services",
] as const satisfies readonly DebugTab[];

export const DEBUG_DIAGNOSTIC_TABS = [
  "logs",
  "queue",
  "ai",
] as const satisfies readonly DebugTab[];

export type DebugSystemTab = (typeof DEBUG_SYSTEM_TABS)[number];

export const visibleDebugTabs = (
  can: (args: PermissionsStaffArgs) => boolean,
): DebugTab[] => DEBUG_TABS.filter(tab => can(DEBUG_TAB_PERMISSION[tab]));
