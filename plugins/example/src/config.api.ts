import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";

import { adminModule } from "@/api/modules/admin/admin.module";
import { CONFIG_PLUGIN } from "@/const";
import "@/api/lib/events";

/**
 * No `contentTypes` here: `buildApiPlugin` walks the module tree, so the
 * content types declared in `admin.module.ts` also drive the registry and the
 * derived `can_view` / `can_create` / `can_edit` / `can_delete` permissions.
 */
export const exampleApiPlugin = () =>
  buildApiPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    modules: [adminModule],
  });
