import type { PluginManifest } from "../../lib/plugin-manifest";
import type { AnyContentContainerDefinition } from "../containers/types";
import type { AnyContentModel } from "./model";

import { buildContentAdminModule } from "./module";
import { buildContentPublicModule } from "./public-module";

/**
 * Binds the Content Engine's module builders to one plugin, so the generated
 * modules are registered under its id. Call it once per plugin, typically in
 * `src/api/builders.ts`, next to `bindApiPlugin`. Server-only.
 *
 * - `buildContentAdminModule` mounts the AdminCP CRUD routes of every model
 *   under the `content` module, one sub-module per `permissionModule`, and
 *   registers the content types (and their staff permissions), the models
 *   background tasks need, and the search indexers. Nest it inside the plugin's
 *   `admin` module.
 * - `buildContentPublicModule` mounts the public read routes - list, detail,
 *   preview, thread, delivery and public-write routes as enabled - under
 *   `content/{publicApi.path}`. Models without `publicApi` are skipped, so both
 *   builders can take the same array.
 *
 * @example
 * ```ts
 * import { bindContentPlugin } from "@vitnode/core/content/server";
 *
 * import { manifest } from "@/manifest.gen";
 *
 * export const { buildContentAdminModule, buildContentPublicModule } =
 *   bindContentPlugin(manifest);
 * ```
 */
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
