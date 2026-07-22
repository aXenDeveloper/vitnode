import { buildModule } from "@vitnode/core/api/lib/module";

import { CONFIG_PLUGIN } from "../../../const";
import { cleanupCategorySearchListener } from "../../lib/events";
import { categoriesAdminModule } from "./categories/categories.admin.module";
import { postsAdminModule } from "./posts/posts.admin.module";

export const adminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "admin",
  modules: [categoriesAdminModule, postsAdminModule],
  routes: [],
  // Event listeners are only collected from top-level modules (like cronJobs
  // and queueTasks), so they are registered here rather than on the nested
  // categories module.
  events: [cleanupCategorySearchListener],
});
