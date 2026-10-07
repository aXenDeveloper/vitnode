import type { ApiPluginContract } from "@vitnode/core/api/lib/plugin";

import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";
import { buildContentPublicModule } from "@vitnode/core/content/server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { CONFIG_PLUGIN } from "@/const";
import { settingsPage } from "@/content/settings-page";
import { advancedArticleContent } from "@/database/advanced-articles";
import { articleContent } from "@/database/articles";
import { categoryContent } from "@/database/categories";
import { eventContent } from "@/database/events";
import { localizedArticleContent } from "@/database/localized-articles";
import { pageContent } from "@/database/pages";
import { tagContent } from "@/database/tags";

import { widgets } from "./widgets";
import "@/api/lib/events";

export const exampleApiPlugin = () =>
  buildApiPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    blocks: widgets,
    editablePages: [settingsPage],
    navigation: [{ href: "/example/browse", icon: "list", id: "browse" }],
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
          eventContent,
          localizedArticleContent,
          pageContent,
          tagContent,
        ],
      }),
    ],
  });

export type VitNodeApiPlugin = ApiPluginContract<
  ReturnType<typeof exampleApiPlugin>
>;
