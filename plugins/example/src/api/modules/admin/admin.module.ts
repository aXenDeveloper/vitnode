import { buildModule } from "@vitnode/core/api/lib/module";
import { buildContentAdminModule } from "@vitnode/core/content/server";

import { CONFIG_PLUGIN } from "@/const";
import { advancedArticleContent } from "@/database/advanced-articles";
import { articleContent } from "@/database/articles";
import { categoryContent } from "@/database/categories";
import { localizedArticleContent } from "@/database/localized-articles";

export const adminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "admin",
  routes: [],
  modules: [
    buildContentAdminModule({
      pluginId: CONFIG_PLUGIN.pluginId,
      // The localized article is registered on the API side only, so its
      // generated CRUD *and* translation routes exist and its staff permissions
      // are derived - but it gets no AdminCP screen yet, because a form that
      // could not edit `title` in any language would be a worse thing to ship
      // than no form at all. Registering it in `config.tsx` alongside the
      // others is what would give it one.
      contentTypes: [
        advancedArticleContent,
        articleContent,
        categoryContent,
        localizedArticleContent,
      ],
    }),
  ],
});
