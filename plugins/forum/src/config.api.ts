import type { ApiPluginContract } from "@vitnode/core/api/lib/plugin";

import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";
import { buildContentPublicModule } from "@vitnode/core/content/server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { forumModule } from "@/api/modules/forum/forum.module";
import { CONFIG_PLUGIN } from "@/const";
import { forumContainers } from "@/content/forums";
import { commentContent } from "@/database/comments";
import { topicContent } from "@/database/topics";
import { pluginMetadata } from "@/plugin-metadata.gen";

export const forumApiPlugin = () =>
  buildApiPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    metadata: pluginMetadata,
    navigation: [{ href: "/forum", icon: "messages-square", id: "forum" }],
    modules: [
      adminModule,
      forumModule,
      buildContentPublicModule({
        pluginId: CONFIG_PLUGIN.pluginId,
        containers: [forumContainers],
        contentTypes: [topicContent, commentContent],
      }),
    ],
  });

export type VitNodeApiPlugin = ApiPluginContract<
  ReturnType<typeof forumApiPlugin>
>;
