import type { PluginRoutePageProps } from "@/routing";

export interface PluginRouteLoaderData {
  /** Whatever the module's `load` returned, or `undefined` if it declares none. */
  data: unknown;

  search: unknown;
}

export type RuntimePluginRoutePageProps = PluginRoutePageProps<
  unknown,
  unknown
>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const pluginRouteLoaderData = (loaderData: unknown): unknown =>
  isRecord(loaderData)
    ? (loaderData as Partial<PluginRouteLoaderData>).data
    : undefined;

/** This route's validated search, out of the same envelope. */
export const pluginRouteSearch = (loaderData: unknown): unknown =>
  (isRecord(loaderData)
    ? (loaderData as Partial<PluginRouteLoaderData>).search
    : undefined) ?? {};

export const pluginRoutePageProps = (
  loaderData: unknown,
  params: Readonly<Record<string, string>>,
  navigate: RuntimePluginRoutePageProps["navigate"],
): RuntimePluginRoutePageProps => ({
  loaderData: pluginRouteLoaderData(loaderData),
  navigate,
  params,
  search: pluginRouteSearch(loaderData),
});
