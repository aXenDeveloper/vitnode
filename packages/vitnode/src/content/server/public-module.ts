import type { BuildModuleReturn } from "../../api/lib/module";
import type { AnyContentTypeDefinition } from "../types";
import type { AnyContentModel } from "./model";

import { buildModule } from "../../api/lib/module";
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

export type ContentPublicModule<
  P extends string,
  Models extends readonly AnyContentModel[],
> = BuildModuleReturn<
  P,
  "content",
  [],
  ContentPublicModuleOf<P, Models[number]>[]
>;

export const buildContentPublicModule = <
  const P extends string,
  const Models extends readonly AnyContentModel[],
>({
  contentTypes,
  pluginId,
}: {
  contentTypes: Models;
  pluginId: P;
}): ContentPublicModule<NoInfer<P>, Models> => {
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
  }) as ContentPublicModule<NoInfer<P>, Models>;
};
