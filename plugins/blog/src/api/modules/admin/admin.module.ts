import { buildModule } from "@vitnode/core/api/lib/module";
import { buildContentAdminModule } from "@vitnode/core/content/server";

import { blogLegacyEventListeners } from "@/api/lib/events";
import { CONFIG_PLUGIN } from "@/const";
import { categoryContent } from "@/database/categories";
import { postContent } from "@/database/posts";

export const adminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "admin",
  routes: [],
  modules: [
    buildContentAdminModule({
      pluginId: CONFIG_PLUGIN.pluginId,
      contentTypes: [categoryContent, postContent],
    }),
  ],
  // Event listeners are only collected from top-level modules, so the
  // compatibility adapters are registered here rather than on a nested one.
  events: blogLegacyEventListeners,
});
