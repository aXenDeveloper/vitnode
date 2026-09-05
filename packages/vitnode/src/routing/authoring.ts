import type {
  PluginRouteBreadcrumbProps,
  PluginRouteHead,
  PluginRouteHeadArgs,
  PluginRouteLoadArgs,
  PluginRouteOptions,
} from "./module";

type UnknownLoaderData =
  "definePluginRoute: `loaderData` is typed only when `load` is declared ABOVE `head`";

type AuthoredPluginRouteOptions<TData, TSearch> = Omit<
  PluginRouteOptions<TData, TSearch>,
  "breadcrumb" | "head" | "load"
> & {
  breadcrumb?:
    | false
    | React.ComponentType<PluginRouteBreadcrumbProps<TData, NoInfer<TSearch>>>;
  head?: (
    args: PluginRouteHeadArgs<NoInfer<TData>, NoInfer<TSearch>>,
  ) => PluginRouteHead;
  load?: (
    args: PluginRouteLoadArgs<NoInfer<TSearch>>,
  ) => Promise<TData> | TData;
};

export const definePluginRoute = <
  TData = UnknownLoaderData,
  TSearch = Record<string, never>,
>(
  options: AuthoredPluginRouteOptions<TData, TSearch>,
): PluginRouteOptions<TData, TSearch> => options;
