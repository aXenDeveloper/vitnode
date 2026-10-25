import type { ApiPluginContract } from "@vitnode/core/api/lib/plugin";

import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";

import { storyExcerptAiAction } from "@/api/ai/actions";
import { buildContentPublicModule } from "@/api/builders";
import { categoryModerationScope } from "@/api/lib/moderation";
import { deskContainers } from "@/content/desks";
import { settingsPage } from "@/content/settings-page";
import { articleContent } from "@/database/articles";
import { bulletinContent } from "@/database/bulletins";
import { categoryContent } from "@/database/categories";
import { commentContent } from "@/database/comments";
import { eventContent } from "@/database/events";
import { explainerContent } from "@/database/explainers";
import { letterContent } from "@/database/letters";
import { pageContent } from "@/database/pages";
import { storyContent } from "@/database/stories";
import { tagContent } from "@/database/tags";
import { manifest } from "@/manifest.gen";

import { adminModule } from "./api/modules/admin/admin.module";
import { helloModule } from "./api/modules/hello/hello.module";
import { widgets } from "./widgets";
import "@/api/lib/events";

export const newsroomApiPlugin = () =>
  buildApiPlugin({
    manifest,
    aiActions: [storyExcerptAiAction],
    blocks: widgets,
    editablePages: [settingsPage],
    moderation: { scopes: [categoryModerationScope] },
    permissionStaff: {
      moderator: {
        widgets: ["can_edit"],
      },
    },
    modules: [
      helloModule,
      adminModule,
      buildContentPublicModule({
        containers: [deskContainers],
        contentTypes: [
          articleContent,
          commentContent,
          storyContent,
          explainerContent,
          bulletinContent,
          categoryContent,
          tagContent,
          eventContent,
          pageContent,
          letterContent,
        ],
      }),
    ],
  });

/**
 * What an application's generated api-registry.gen.ts imports to make this
 * plugin's routes callable through the fetcher.
 *
 * Reduced here, once, to the module tree and the route definitions - so no app
 * that installs this plugin re-derives them, and none of the Hono, database or
 * secret code behind the factory is reachable from a browser build.
 */
export type VitNodeApiPlugin = ApiPluginContract<
  ReturnType<typeof newsroomApiPlugin>
>;
