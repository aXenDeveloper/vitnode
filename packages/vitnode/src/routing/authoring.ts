import type {
  PluginRouteBreadcrumbDeclaration,
  PluginRouteContext,
  PluginRouteHead,
  PluginRouteHeadArgs,
  PluginRouteLoadArgs,
  PluginRouteOptions,
} from "./module";

type UnknownLoaderData =
  "definePluginRoute: `loaderData` is typed only when `load` is declared ABOVE `head`";

/**
 * `PluginRouteOptions`, arranged so a plugin's `load` types its `head` and its
 * breadcrumb.
 *
 * Exported for the framework layer's own authoring helpers, which bind
 * `TContext` to the richer context they actually provide - see
 * `@vitnode/core/tanstack/plugin-routes`. `definePluginRoute` below pins it to
 * {@link PluginRouteContext}, so the plugin-facing door still promises exactly
 * what every host guarantees and nothing more.
 */
export type AuthoredPluginRouteOptions<TData, TSearch, TContext> = Omit<
  PluginRouteOptions<TData, TSearch, TContext>,
  "breadcrumb" | "head" | "load"
> & {
  breadcrumb?: PluginRouteBreadcrumbDeclaration<TData, NoInfer<TSearch>>;
  head?: (
    args: PluginRouteHeadArgs<NoInfer<TData>, NoInfer<TSearch>>,
  ) => PluginRouteHead;
  load?: (
    args: PluginRouteLoadArgs<NoInfer<TSearch>, TContext>,
  ) => Promise<TData> | TData;
};

export const definePluginRoute = <
  TData = UnknownLoaderData,
  TSearch = Record<string, never>,
>(
  options: AuthoredPluginRouteOptions<TData, TSearch, PluginRouteContext>,
): PluginRouteOptions<TData, TSearch> => options;
