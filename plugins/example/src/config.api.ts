import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";
import { buildContentPublicModule } from "@vitnode/core/content/server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { CONFIG_PLUGIN } from "@/const";
import { articleContent } from "@/database/articles";
import { categoryContent } from "@/database/categories";
import "@/api/lib/events";

/**
 * No `contentTypes` here: `buildApiPlugin` walks the module tree, so the
 * content types declared in `admin.module.ts` also drive the registry and the
 * derived `can_view` / `can_create` / `can_edit` / `can_delete` permissions.
 *
 * `buildContentPublicModule` is top-level on purpose - its paths must stay out
 * of `/admin/`, which the global admin gate matches as a substring. It skips
 * any content type without `publicApi`, so `categoryContent` contributes
 * nothing, and it registers no content types of its own (that would be a
 * duplicate registration).
 *
 * Public routes land at `/api/@vitnode/example/content/articles/`.
 */
export const exampleApiPlugin = () =>
  buildApiPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    modules: [
      adminModule,
      buildContentPublicModule({
        pluginId: CONFIG_PLUGIN.pluginId,
        contentTypes: [articleContent, categoryContent],
      }),
    ],
  });
