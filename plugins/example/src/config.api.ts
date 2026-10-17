import type { ApiPluginContract } from "@vitnode/core/api/lib/plugin";

import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";

import { articleExcerptAiAction } from "@/api/ai/actions";
import { buildContentPublicModule } from "@/api/builders";
import { exampleCategoryScope } from "@/api/lib/moderation";
import { adminModule } from "@/api/modules/admin/admin.module";
import { boardContainers } from "@/content/boards";
import { settingsPage } from "@/content/settings-page";
import { advancedArticleContent } from "@/database/advanced-articles";
import { articleContent } from "@/database/articles";
import { categoryContent } from "@/database/categories";
import { discussionContent } from "@/database/discussions";
import { eventContent } from "@/database/events";
import { localizedArticleContent } from "@/database/localized-articles";
import { pageContent } from "@/database/pages";
import { tagContent } from "@/database/tags";
import { manifest } from "@/manifest.gen";

import { widgets } from "./widgets";
import "@/api/lib/events";

export const exampleApiPlugin = () =>
  buildApiPlugin({
    manifest,
    aiActions: [articleExcerptAiAction],
    blocks: widgets,
    editablePages: [settingsPage],
    moderation: { scopes: [exampleCategoryScope] },
    permissionStaff: {
      moderator: {
        widgets: ["can_edit"],
      },
    },
    modules: [
      adminModule,
      buildContentPublicModule({
        containers: [boardContainers],
        contentTypes: [
          advancedArticleContent,
          articleContent,
          categoryContent,
          discussionContent,
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
