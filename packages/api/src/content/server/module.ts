import type { BuildModuleReturn } from "../../lib/module";
import type { AnyContentContainerDefinition } from "../containers/types";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentMcpExposure, ContentMcpOperation } from "./mcp";
import type { AnyContentModel, ContentModel } from "./model";

import { buildModule } from "../../lib/module";
import { buildContentContainerAdminRoutes } from "../containers/server/admin-routes";
import { exposeContentRoutesOnMcp } from "./mcp";
import { buildContentRoutes } from "./routes";
import {
  createContentLocalizedSearchIndexer,
  createContentSearchIndexer,
} from "./search-indexer";
import { assertContentReferences } from "./table";

/** The content type id of a model, as a literal when the model has one. */
export type ContentModelId<TModel> =
  TModel extends ContentModel<infer TDefinition>
    ? TDefinition extends { id: infer Id extends string }
      ? Id
      : string
    : string;

/** What `buildContentAdminModule` accepts. */
export interface ContentAdminModuleOptions<
  Models extends readonly AnyContentModel[] = readonly AnyContentModel[],
> {
  containers?: AnyContentContainerDefinition[];
  contentTypes: Models;
  /**
   * Generated routes to expose as MCP tools, per content type id - off for
   * every content type and operation not listed. Each tool runs its route with
   * the route's own `can_*` permission, as the token's owner. See
   * `ContentMcpExposure`.
   */
  mcp?: ContentMcpExposure<ContentModelId<Models[number]>>;
}

/**
 * The generated AdminCP module, named `content`. Prefer the plugin-bound
 * version from `bindContentPlugin()`.
 *
 * Resolves every relation's foreign key while building, so a reference whose
 * target column is missing or has the wrong key type fails at boot rather than
 * at the first query.
 *
 * @throws When `mcp` names a content type that is not in `contentTypes`, or an
 * operation that content type has no route for.
 */
export const buildContentAdminModule = <
  P extends string,
  const Models extends readonly AnyContentModel[] = readonly AnyContentModel[],
>({
  containers = [],
  contentTypes,
  mcp,
  pluginId,
}: ContentAdminModuleOptions<Models> & {
  pluginId: P;
}): BuildModuleReturn<NoInfer<P>, "content"> => {
  const exposure: Partial<Record<string, readonly ContentMcpOperation[]>> =
    mcp ?? {};
  const known = new Set(contentTypes.map(model => model.definition.id));
  for (const id of Object.keys(exposure)) {
    if (!known.has(id)) {
      throw new Error(
        `[Content Engine] \`mcp\` names "${id}", which is not one of this module's content types (${[...known].join(", ")}).`,
      );
    }
  }

  const modules = contentTypes.map(model => {
    // Every `src/database/*.ts` has loaded by the time this module is built, so
    // it is the first safe moment to check that each relation points at the
    // table its descriptor promised.
    assertContentReferences(model.table);

    const routes = buildContentRoutes(model, { pluginId });
    const operations = exposure[model.definition.id];
    if (operations) {
      exposeContentRoutesOnMcp(
        model.definition as AnyContentTypeDefinition,
        routes,
        operations,
      );
    }

    return buildModule({
      pluginId,
      name: model.definition.permissionModule,
      routes,
    });
  });

  const containerModules = containers.map(definition =>
    buildModule({
      pluginId,
      name: definition.admin.permissionModule,
      routes: buildContentContainerAdminRoutes(definition, { pluginId }),
    }),
  );

  return buildModule({
    pluginId,
    name: "content",
    routes: [],
    modules: [...modules, ...containerModules],
    contentContainers: containers,
    contentTypes: contentTypes.map(model => model.definition),
    // The models themselves, not just the definitions. Background work - the
    // scheduled-publication task - needs the table and the editorial service,
    // and it runs in a cron request that knows nothing but a content type id.
    contentModels: [...contentTypes],
    // A content type without `search` contributes nothing, so the two module
    // builders can keep taking the same array. The plugin id travels with the
    // indexer so a rebuild - which runs in the core cron request - still stores
    // the owning plugin on every document.
    searchIndexers: contentTypes
      .filter(model => model.definition.search.enabled)
      // A localized content type is indexed once per published translation, so
      // its rebuild pages over translations rather than over records. Chosen here
      // rather than inside one indexer because the two page differently -
      // keyset over `(itemId, languageId)` against offset over `id`.
      .map(model =>
        model.definition.localization.enabled
          ? createContentLocalizedSearchIndexer(model, { pluginId })
          : createContentSearchIndexer(model, { pluginId }),
      ),
  });
};
