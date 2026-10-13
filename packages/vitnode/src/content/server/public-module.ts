import type { BuildModuleReturn } from "../../api/lib/module";
import type { AnyContentContainerDefinition } from "../containers/types";
import type { AnyContentTypeDefinition } from "../types";
import type { AnyContentModel } from "./model";

import { buildModule } from "../../api/lib/module";
import { buildContentContainerPublicRoutes } from "../containers/server/public-routes";
import { buildContentPublicRoutes } from "./public-routes";

export type ContentPublicRoutes<
  P extends string,
  TDefinition extends AnyContentTypeDefinition,
> = ReturnType<typeof buildContentPublicRoutes<TDefinition, P>>;

export type ContentPublicModuleOf<P extends string, Model> = Model extends {
  definition: infer TDefinition extends AnyContentTypeDefinition;
}
  ? TDefinition extends {
      publicApi: { enabled: true; path: infer Path extends string };
    }
    ? BuildModuleReturn<P, Path, ContentPublicRoutes<P, TDefinition>>
    : never
  : never;

export type ContentContainerPublicRoutes<
  P extends string,
  TDefinition extends AnyContentContainerDefinition,
> = ReturnType<typeof buildContentContainerPublicRoutes<TDefinition, P>>;

export type ContentContainerPublicModuleOf<
  P extends string,
  TDefinition,
> = TDefinition extends AnyContentContainerDefinition
  ? TDefinition extends {
      publicApi: { enabled: true; path: infer Path extends string };
    }
    ? BuildModuleReturn<P, Path, ContentContainerPublicRoutes<P, TDefinition>>
    : never
  : never;

export type ContentPublicModule<
  P extends string,
  Models extends readonly AnyContentModel[],
  Containers extends readonly AnyContentContainerDefinition[] = readonly [],
> = BuildModuleReturn<
  P,
  "content",
  [],
  (
    | ContentContainerPublicModuleOf<P, Containers[number]>
    | ContentPublicModuleOf<P, Models[number]>
  )[]
>;

export const buildContentPublicModule = <
  const P extends string,
  const Models extends readonly AnyContentModel[],
  const Containers extends readonly AnyContentContainerDefinition[] =
    readonly [],
>({
  containers = [] as unknown as Containers,
  contentTypes,
  pluginId,
}: {
  /** Container collections whose `publicApi` gets read routes beside the content types'. */
  containers?: Containers;
  contentTypes: Models;
  pluginId: P;
}): ContentPublicModule<NoInfer<P>, Models, Containers> => {
  const modules = contentTypes
    .filter(model => model.definition.publicApi.enabled)
    .map(model =>
      buildModule({
        pluginId,
        name: model.definition.publicApi.path,
        routes: buildContentPublicRoutes(model, { pluginId }),
      }),
    );
  const containerModules = containers
    .filter(definition => definition.publicApi.enabled)
    .map(definition =>
      buildModule({
        pluginId,
        name: definition.publicApi.path,
        routes: buildContentContainerPublicRoutes(definition, { pluginId }),
      }),
    );

  return buildModule({
    pluginId,
    name: "content",
    routes: [],
    modules: [...modules, ...containerModules],
    contentContainers: [...containers],
    // No `contentTypes` - see the warning above.
    publicContentTypes: contentTypes.map(model => model.definition),
  }) as ContentPublicModule<NoInfer<P>, Models, Containers>;
};
