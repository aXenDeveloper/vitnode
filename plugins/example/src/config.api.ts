import type { ApiPluginContract } from "@vitnode/core/api/lib/plugin";

import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";
import { buildContentPublicModule } from "@vitnode/core/content/server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { CONFIG_PLUGIN } from "@/const";
import { settingsPage } from "@/content/settings-page";
import { advancedArticleContent } from "@/database/advanced-articles";
import { articleContent } from "@/database/articles";
import { categoryContent } from "@/database/categories";
import { localizedArticleContent } from "@/database/localized-articles";
import { pageContent } from "@/database/pages";

import { widgets } from "./widgets";
import "@/api/lib/events";

export const exampleApiPlugin = () =>
  buildApiPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    blocks: widgets,
    editablePages: [settingsPage],
    permissionStaff: {
      moderator: {
        widgets: ["can_edit"],
      },
    },
    modules: [
      adminModule,
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
