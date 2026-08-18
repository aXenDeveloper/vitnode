import type { BuildModuleReturn } from "../../api/lib/module";
import type { AnyContentTypeDefinition } from "../types";
import type { AnyContentModel } from "./model";

import { buildModule } from "../../api/lib/module";
import { buildContentPublicRoutes } from "./public-routes";

/**
 * Builds the generated public module for a plugin's content types.
 *
 * A **top-level** module, unlike `buildContentAdminModule`, so the paths land
 * outside `/admin/` and the global admin gate never sees them:
 *
 * ```ts
 * buildApiPlugin({
 *   pluginId: CONFIG_PLUGIN.pluginId,
 *   modules: [
 *     adminModule,
 *     buildContentPublicModule({ pluginId, contentTypes: [articleContent] }),
 *   ],
 * });
 * ```
 *
 * That yields `GET /api/{pluginId}/content/{publicApi.path}/` and `/{slug}`.
 *
 * Pass every model you like: a content type without `publicApi` is skipped, so
 * the two module builders can take the same array.
 *
 * <Callout type="warn">
 * This module deliberately does **not** set `contentTypes`. `buildApiPlugin`
 * collects them recursively, and registering a content type twice makes
 * `validateContentTypes` throw "Duplicate content type id". Only
 * `buildContentAdminModule` registers.
 * </Callout>
 */
export const buildContentPublicModule = <P extends string>({
  contentTypes,
  pluginId,
}: {
  contentTypes: AnyContentModel[];
  pluginId: P;
}): BuildModuleReturn<P, "content"> => {
  const modules = contentTypes
    .filter(model => model.definition.publicApi.enabled)
    .map(model =>
      buildModule({
        pluginId,
        name: model.definition.publicApi.path,
        routes: buildContentPublicRoutes(model, { pluginId }),
      }),
    );

  return buildModule({
    pluginId,
    name: "content",
    routes: [],
    modules,
    // No `contentTypes` - see the warning above.
  });
};
