import type { BuildModuleReturn } from "../../api/lib/module";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentModel } from "./model";

import { buildModule } from "../../api/lib/module";
import { buildContentRoutes } from "./routes";
import { assertContentReferences } from "./table";

/**
 * Builds the generated CRUD module for a plugin's content types.
 *
 * Nest it inside the plugin's own `admin` module - Hono only serves the last
 * sub-app mounted at a given prefix, so the engine must never add a second
 * `/admin` of its own:
 *
 * ```ts
 * export const adminModule = buildModule({
 *   pluginId: CONFIG_PLUGIN.pluginId,
 *   name: "admin",
 *   routes: [],
 *   modules: [buildContentAdminModule({ pluginId, contentTypes: [articleContent] })],
 * });
 * ```
 *
 * That yields `/api/{pluginId}/admin/content/{module}`. `buildApiPlugin` walks
 * the module tree, so the content types registered here also drive the
 * registry and the derived staff permissions - they are declared exactly once.
 */
export const buildContentAdminModule = <P extends string>({
  contentTypes,
  pluginId,
}: {
  contentTypes: ContentModel<AnyContentTypeDefinition>[];
  pluginId: P;
}): BuildModuleReturn<P, "content"> => {
  const modules = contentTypes.map(model => {
    // Every `src/database/*.ts` has loaded by the time this module is built, so
    // it is the first safe moment to check that each relation points at the
    // table its descriptor promised.
    assertContentReferences(model.table);

    return buildModule({
      pluginId,
      name: model.definition.permissionModule,
      routes: buildContentRoutes(model, { pluginId }),
    });
  });

  return buildModule({
    pluginId,
    name: "content",
    routes: [],
    modules,
    contentTypes: contentTypes.map(model => model.definition),
  });
};
