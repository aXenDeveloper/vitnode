import { buildModule } from "@vitnode/core/api/lib/module";

import { CONFIG_PLUGIN } from "../../../const";
import { categoriesAdminModule } from "./categories/categories.admin.module";
import { postsAdminModule } from "./posts/posts.admin.module";

export const adminModule = buildModule({
  name: "admin",
  modules: [categoriesAdminModule, postsAdminModule],
  routes: [],
});

export const adminModuleApi = adminModule.build(CONFIG_PLUGIN.pluginId);
