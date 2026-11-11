import { defineStaffPermissions } from "@vitnode/core/lib/staff-permissions";

import { manifest } from "@/manifest.gen";

/** The newsroom's own staff permissions; the Content Engine adds those of its content types. */
export const staffPermissions = defineStaffPermissions(manifest, {
  admin: {
    corrections: ["can_create"],
  },
  moderator: {
    widgets: ["can_edit"],
  },
});
