import type { PluginRoutePageProps } from "@/routing";

/**
 * What a plugin route's loader returns, and therefore what its `head` and its
 * component are handed.
 *
 * Two fields rather than the plugin's data alone, because the loader is also
 * where a plugin route's search contract is applied - see `./mount` for why it
 * cannot be applied where a route normally applies one - and `head` needs the
 * same validated value `load` was given. Carrying it here is what makes the two
 * provably the same object rather than the same function run twice.
 *
 * Internal to the runtime: a plugin never sees this envelope. Its `load` returns
 * its own data, and its component and `head` are handed that data back under the
 * name `loaderData`.
 */
export interface PluginRouteLoaderData {
  /** Whatever the module's `load` returned, or `undefined` if it declares none. */
  data: unknown;
  /**
   * The route's validated search: its eager `search` schema when its declaration
   * has one, its module's `parseSearch` otherwise, or `{}` when it declares
   * neither.
   */
  search: unknown;
}

/**
 * What a plugin route's component is rendered with, as the runtime sees it.
 *
 * `PluginRoutePageProps` is the contract's own - `@vitnode/core/routing` - and
 * the whole of what this alias adds is the two type arguments a runtime cannot
 * know: what a *particular* plugin's loader returned, and what its
 * `parseSearch` returned, are the plugin's business and were checked on the
 * plugin's side. Naming the shared type rather than restating its three fields
 * is what keeps the props a plugin declares and the props this runtime passes
 * provably the same object.
 */
export type RuntimePluginRoutePageProps = PluginRoutePageProps<
  unknown,
  unknown
>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Whatever this route's `load` returned, out of the runtime's envelope.
 *
 * Total: a loader that has not run - or a match whose loader threw, which is
 * still a match and still renders its crumb - reads as `undefined` rather than
 * throwing on a property of nothing.
 */
export const pluginRouteLoaderData = (loaderData: unknown): unknown =>
  isRecord(loaderData)
    ? (loaderData as Partial<PluginRouteLoaderData>).data
    : undefined;

/** This route's validated search, out of the same envelope. */
export const pluginRouteSearch = (loaderData: unknown): unknown =>
  (isRecord(loaderData)
    ? (loaderData as Partial<PluginRouteLoaderData>).search
    : undefined) ?? {};

/**
 * The loader's envelope and the match's params, as the props a plugin page
 * renders with.
 *
 * Total: a loader that has not run, or one whose result is not the envelope this
 * runtime builds, still produces a complete props object rather than a spread
 * that throws.
 */
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
