import { buildModule } from "@vitnode/core/api/lib/module";
import { buildContentAdminModule } from "@vitnode/core/content/server";

import { blogLegacyEventListeners } from "@/api/lib/events";
import { CONFIG_PLUGIN } from "@/const";
import { categoryContent } from "@/database/categories";
import { postContent } from "@/database/posts";

/**
 * Every admin route the blog has, generated from two content types.
 *
 * The generated content module is nested here rather than mounted by the engine:
 * Hono serves only the last sub-app mounted at a prefix, so a second top-level
 * `/admin` would silently shadow this one.
 *
 * Routes land at `/api/@vitnode/blog/admin/content/{posts,categories}`, and the
 * staff permissions they check are the modules the blog has always used.
 */
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
