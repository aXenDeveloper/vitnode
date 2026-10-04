import type { ApiPluginContract } from "@vitnode/core/api/lib/plugin";

import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";
import { buildContentPublicModule } from "@vitnode/core/content/server";

import {
  blogCategorySubject,
  postPublishedNotification,
} from "@/api/lib/notifications";
import { adminModule } from "@/api/modules/admin/admin.module";
import { CONFIG_PLUGIN } from "@/const";
import { categoryContent } from "@/database/categories";
import { postContent } from "@/database/posts";
import apiMessages from "@/locales/api";

export const blogApiPlugin = () =>
  buildApiPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    messages: apiMessages,
    notificationTypes: [postPublishedNotification],
    notificationSubjects: [blogCategorySubject],
    modules: [
      adminModule,
      buildContentPublicModule({
        pluginId: CONFIG_PLUGIN.pluginId,
        // Skips any content type without `publicApi`, so the category
        // contributes nothing - it has no public URL of its own.
        contentTypes: [categoryContent, postContent],
      }),
    ],
  });

export type VitNodeApiPlugin = ApiPluginContract<
  ReturnType<typeof blogApiPlugin>
>;
