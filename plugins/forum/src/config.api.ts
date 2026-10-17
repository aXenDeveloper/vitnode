import type { ApiPluginContract } from "@vitnode/core/api/lib/plugin";

import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";

import { buildContentPublicModule } from "@/api/builders";
import { adminModule } from "@/api/modules/admin/admin.module";
import { forumModule } from "@/api/modules/forum/forum.module";
import { forumContainers } from "@/content/forums";
import { commentContent } from "@/database/comments";
import { topicContent } from "@/database/topics";
import { manifest } from "@/manifest.gen";

export const forumApiPlugin = () =>
  buildApiPlugin({
    manifest,
    modules: [
      adminModule,
      forumModule,
      buildContentPublicModule({
        containers: [forumContainers],
        contentTypes: [topicContent, commentContent],
      }),
    ],
  });

export type VitNodeApiPlugin = ApiPluginContract<
  ReturnType<typeof forumApiPlugin>
>;
