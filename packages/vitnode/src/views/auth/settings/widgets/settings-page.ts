import { defineEditablePage } from "@/content/editor";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

export const SETTINGS_PAGE_ID = "core:settings";

export const SETTINGS_ZONE_IDS = {
  footer: "footer",
  header: "header",
} as const;

const SETTINGS_ZONE_MAX_BLOCKS = 10;

export const settingsPage = defineEditablePage({
  id: SETTINGS_PAGE_ID,

  permission: coreStaffPermissions.moderator.widgets.canEdit,

  zones: {
    [SETTINGS_ZONE_IDS.header]: { max: SETTINGS_ZONE_MAX_BLOCKS },
    [SETTINGS_ZONE_IDS.footer]: { max: SETTINGS_ZONE_MAX_BLOCKS },
  },
});
