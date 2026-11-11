import { manifest } from "@/manifest";

import { defineStaffPermissions } from "./staff-permissions";

/**
 * Core's staff permissions, declared once: `buildApiPlugin` registers them,
 * and routes, AdminCP navigation and permission checks reference them as
 * `coreStaffPermissions.admin.users.canEdit`. Browser-safe.
 */
export const coreStaffPermissions = defineStaffPermissions(manifest, {
  moderator: {
    users: ["can_edit", "can_view_hidden_presence"],
    widgets: ["can_edit"],
    warnings: [
      "can_view",
      "can_warn",
      "can_override_points",
      "can_override_expiration",
      { permission: "can_view_notes", dependsOn: ["can_view"] },
      { permission: "can_revoke", dependsOn: ["can_view"] },
      "can_view_sanctions",
      {
        permission: "can_manage_sanctions",
        dependsOn: ["can_view_sanctions"],
      },
    ],
  },
  admin: {
    dashboard: [
      "can_view",
      { permission: "can_edit", dependsOn: ["can_view"] },
    ],
    users: [
      "can_view",
      { permission: "can_create", dependsOn: ["can_view"] },
      { permission: "can_edit", dependsOn: ["can_view"] },
      { permission: "can_edit_admin", dependsOn: ["can_view"] },
      { permission: "can_view_hidden_presence", dependsOn: ["can_view"] },
    ],
    roles: [
      "can_view",
      { permission: "can_create", dependsOn: ["can_view"] },
      { permission: "can_edit", dependsOn: ["can_view"] },
      { permission: "can_edit_admin", dependsOn: ["can_edit"] },
      { permission: "can_delete", dependsOn: ["can_view"] },
      { permission: "can_delete_admin", dependsOn: ["can_delete"] },
    ],
    debug: [
      "can_view",
      { permission: "can_clear_cache", dependsOn: ["can_view"] },
    ],
    system: [
      "can_view",
      { permission: "can_send_test_email", dependsOn: ["can_view"] },
      { permission: "can_test_storage", dependsOn: ["can_view"] },
      { permission: "can_test_ai", dependsOn: ["can_view"] },
      { permission: "can_manage_search", dependsOn: ["can_view"] },
    ],
    files: [
      "can_view",
      { permission: "can_edit_alt", dependsOn: ["can_view"] },
      { permission: "can_download", dependsOn: ["can_view"] },
      { permission: "can_delete", dependsOn: ["can_view"] },
      "can_upload",
    ],
    queue: ["can_view"],
    plugins: [
      "can_view",
      { permission: "can_check_updates", dependsOn: ["can_view"] },
    ],
    notifications: [
      "can_view",
      { permission: "can_edit", dependsOn: ["can_view"] },
      { permission: "can_manage", dependsOn: ["can_view"] },
    ],
    ai: ["can_view", { permission: "can_manage", dependsOn: ["can_view"] }],
    cron: ["can_view", { permission: "can_run", dependsOn: ["can_view"] }],
    activity_logs: [
      "can_view",
      { permission: "can_view_sensitive", dependsOn: ["can_view"] },
      { permission: "can_export", dependsOn: ["can_view"] },
    ],
    report_reasons: [
      "can_view",
      { permission: "can_create", dependsOn: ["can_view"] },
      { permission: "can_edit", dependsOn: ["can_view"] },
      { permission: "can_delete", dependsOn: ["can_view"] },
    ],
    warning_settings: [
      "can_view",
      { permission: "can_manage", dependsOn: ["can_view"] },
    ],
    staff_moderators: [
      "can_view",
      { permission: "can_create", dependsOn: ["can_view"] },
      { permission: "can_edit", dependsOn: ["can_view"] },
      { permission: "can_delete", dependsOn: ["can_view"] },
    ],
    staff_admins: [
      "can_view",
      { permission: "can_create", dependsOn: ["can_view"] },
      { permission: "can_edit", dependsOn: ["can_view"] },
      { permission: "can_delete", dependsOn: ["can_view"] },
    ],
  },
});
