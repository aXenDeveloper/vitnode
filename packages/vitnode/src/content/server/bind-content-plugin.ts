import type { PluginManifest } from "../../lib/plugin-manifest";
import type { AnyContentContainerDefinition } from "../containers/types";
import type { AnyContentModel } from "./model";

import { buildContentAdminModule } from "./module";
import { buildContentPublicModule } from "./public-module";

export const bindContentPlugin = <const Plugin extends string>(
  manifest: Pick<PluginManifest<Plugin>, "id">,
) => ({
  buildContentAdminModule: (options: {
    containers?: AnyContentContainerDefinition[];
    contentTypes: AnyContentModel[];
  }) => buildContentAdminModule({ ...options, pluginId: manifest.id }),
  buildContentPublicModule: <
    const Models extends readonly AnyContentModel[],
    const Containers extends readonly AnyContentContainerDefinition[] =
      readonly [],
  >(options: {
    containers?: Containers;
    contentTypes: Models;
  }) =>
    buildContentPublicModule<Plugin, Models, Containers>({
      ...options,
      pluginId: manifest.id,
    }),
});
