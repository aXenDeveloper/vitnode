import { CONFIG_PLUGIN } from "@/config";

import { buildApiPlugin } from "./lib/plugin";
import { adminModule } from "./modules/admin/admin.module";
import { cronModule } from "./modules/cron/cron.module";
import { middlewareModule } from "./modules/middleware/middleware.module";
import { usersModule } from "./modules/users/users.module";

export const newBuildPluginApiCore = buildApiPlugin({
  pluginId: CONFIG_PLUGIN.pluginId,
  modules: [middlewareModule, usersModule, adminModule, cronModule],
  permissionStaff: {
    moderator: {
      users: ["can_edit"],
    },
    admin: {
      users: [
        "can_view",
        { permission: "can_create", dependsOn: ["can_view"] },
        { permission: "can_edit", dependsOn: ["can_view"] },
        { permission: "can_edit_admin", dependsOn: ["can_view"] },
      ],
      roles: ["can_manage"],
      debug: [
        "can_view",
        { permission: "can_clear_cache", dependsOn: ["can_view"] },
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
  },
});
