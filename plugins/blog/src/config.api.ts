import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";

import { adminModule } from "./api/modules/admin/admin.module";
import { categoriesModule } from "./api/modules/categories/categories.module";
import { postsModule } from "./api/modules/posts/posts.module";

export const blogApiPlugin = () => {
  return buildApiPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    modules: [adminModule, categoriesModule, postsModule],
  });
};
