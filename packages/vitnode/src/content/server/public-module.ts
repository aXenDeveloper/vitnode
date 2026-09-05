import type { BuildModuleReturn } from "../../api/lib/module";
import type { AnyContentModel } from "./model";

import { buildModule } from "../../api/lib/module";
import { buildContentPublicRoutes } from "./public-routes";

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
