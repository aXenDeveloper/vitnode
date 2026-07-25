import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";

import { blogPostSearchIndexer } from "./api/lib/search";
import { adminModule } from "./api/modules/admin/admin.module";
import { categoriesModule } from "./api/modules/categories/categories.module";
import { postsModule } from "./api/modules/posts/posts.module";
import messages from "./locales";

export const blogApiPlugin = () => {
  return buildApiPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    messages,
    modules: [adminModule, categoriesModule, postsModule],
    searchIndexers: [blogPostSearchIndexer],
    permissionStaff: {
      moderator: {
        posts: ["can_edit", "can_delete"],
      },
      admin: {
        posts: [
          "can_view",
          {
            permission: "can_create",
            dependsOn: ["can_view"],
          },
          "can_edit",
          "can_delete",
        ],
        categories: ["can_view", "can_create", "can_edit", "can_delete"],
      },
    },
  });
};
