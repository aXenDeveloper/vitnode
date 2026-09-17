import type { ApiPluginContract } from "@vitnode/core/api/lib/plugin";

import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";
import { buildContentPublicModule } from "@vitnode/core/content/server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { zonesModule } from "@/api/modules/zones/zones.module";
import { CONFIG_PLUGIN } from "@/const";
import { advancedArticleContent } from "@/database/advanced-articles";
import { articleContent } from "@/database/articles";
import { categoryContent } from "@/database/categories";
import { localizedArticleContent } from "@/database/localized-articles";
import { pageContent } from "@/database/pages";

import { blocks } from "./blocks";
import "@/api/lib/events";

export const exampleApiPlugin = () =>
  buildApiPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    blocks,
    modules: [
      adminModule,
      zonesModule,
      buildContentPublicModule({
        pluginId: CONFIG_PLUGIN.pluginId,
        contentTypes: [
          advancedArticleContent,
          articleContent,
          categoryContent,
          localizedArticleContent,
          pageContent,
        ],
      }),
    ],
  });

export type VitNodeApiPlugin = ApiPluginContract<
  ReturnType<typeof exampleApiPlugin>
>;
