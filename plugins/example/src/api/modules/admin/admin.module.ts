import { buildModule } from "@vitnode/core/api/lib/module";
import { buildContentAdminModule } from "@vitnode/core/content/server";

import { CONFIG_PLUGIN } from "@/const";
import { articleContent } from "@/database/articles";
import { categoryContent } from "@/database/categories";

/**
 * The generated content module is nested here rather than mounted by the
 * engine: Hono serves only the last sub-app mounted at a prefix, so a second
 * top-level `/admin` would silently shadow this one.
 *
 * Routes land at `/api/@vitnode/example/admin/content/{module}`.
 */
export const adminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "admin",
  routes: [],
  modules: [
    buildContentAdminModule({
      pluginId: CONFIG_PLUGIN.pluginId,
      contentTypes: [articleContent, categoryContent],
    }),
  ],
});
