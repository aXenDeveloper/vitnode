import type { ApiPluginContract } from "@/lib/fetcher/contract";

import { blocks } from "@/blocks/built-in";
import { CONFIG_PLUGIN } from "@/config";
import { settingsPage } from "@/views/auth/settings/widgets/settings-page";

import { buildApiPlugin } from "./lib/plugin";
import { adminModule } from "./modules/admin/admin.module";
import { contentModule } from "./modules/content/content.module";
import { cronModule } from "./modules/cron/cron.module";
import { middlewareModule } from "./modules/middleware/middleware.module";
import { pagesModule } from "./modules/pages/pages.module";
import { queueModule } from "./modules/queue/queue.module";
import { searchModule } from "./modules/search/search.module";
import { usersModule } from "./modules/users/users.module";

export const newBuildPluginApiCore = buildApiPlugin({
  pluginId: CONFIG_PLUGIN.pluginId,
  blocks,
  editablePages: [settingsPage],
  navigation: [
    { href: "/discover", icon: "compass", id: "discover" },
    { href: "/search", icon: "search", id: "search" },
  ],
  modules: [
    middlewareModule,
    usersModule,
    adminModule,
    contentModule,
    cronModule,
    pagesModule,
    queueModule,
    searchModule,
  ],
  permissionStaff: {
    moderator: {
      users: ["can_edit"],
      widgets: ["can_edit"],
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
      ],
      files: [
        "can_view",
        { permission: "can_download", dependsOn: ["can_view"] },
        { permission: "can_delete", dependsOn: ["can_view"] },
      ],
      navigation: [
        "can_view",
        { permission: "can_create", dependsOn: ["can_view"] },
        { permission: "can_edit", dependsOn: ["can_view"] },
        { permission: "can_delete", dependsOn: ["can_view"] },
      ],
      queue: ["can_view"],
      cron: ["can_view", { permission: "can_run", dependsOn: ["can_view"] }],
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
  },
});

export type VitNodeApiPlugin = ApiPluginContract<typeof newBuildPluginApiCore>;
