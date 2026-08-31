import type { PluginRouteDefinition } from "../../routing/types.js";

/**
 * The two fields of a {@link PluginRouteDefinition} the build actually reads.
 *
 * `Pick`, not a re-declaration: the plugin route manifest owns what a route is,
 * and this layer only has to know which module to import and what to call it.
 * Deriving the type means a rename there is a compile error here rather than two
 * definitions that agree until somebody edits one.
 *
 * `entry` is a *package export subpath* - `"routes/example-page"`, imported as
 * `"@vitnode/example/routes/example-page"` - rather than a file path, so a plugin
 * can move its implementation inside `dist` without breaking every app that
 * installed it. Everything else on a definition (`path`, `area`, and whatever
 * the manifest grows) is carried past this layer untouched.
 */
export type PluginRouteEntryDeclaration = Pick<
  PluginRouteDefinition,
  "entry" | "id"
>;

/**
 * One configured plugin, and the route entries it declares.
 *
 * Structurally satisfied by the manifest layer's own `PluginRouteSource`, so an
 * app reads each plugin's route list once and hands the same array to both.
 */
export interface PluginRouteEntrySource {
  pluginId: string;
  routes?: readonly PluginRouteEntryDeclaration[];
}

/**
 * A declaration once it has been validated and paired with the import specifier
 * the generated registry will contain.
 *
 * `key` is the manifest layer's own `<pluginId>:<routeId>` route id - built by
 * its `pluginRouteId`, not by a second copy of the same rule - so a route's
 * module loader is registered under exactly the id the manifest gave it, and
 * neither side has to translate.
 */
export interface ResolvedPluginRouteModule {
  entry: string;
  key: string;
  pluginId: string;
  routeId: string;
  specifier: string;
}

/**
 * A lazy import of one plugin route module.
 *
 * `unknown`, not a route type: the registry's job is to hand back the module, and
 * what a module is expected to export is not this layer's contract. The
 * generated file uses `satisfies` against {@link PluginRouteModuleRegistry}, so
 * each loader keeps the real `typeof import("...")` of its own module and a
 * consumer gets those exports typed without this type having to name them.
 */
export type PluginRouteModuleLoader = () => Promise<unknown>;

/** Every plugin route module of an app, keyed by {@link ResolvedPluginRouteModule.key}. */
export type PluginRouteModuleRegistry = Readonly<
  Record<string, PluginRouteModuleLoader>
>;

/**
 * A route's eager search module, paired with the specifier that imports it.
 *
 * The twin of {@link ResolvedPluginRouteModule}, and deliberately a separate
 * type rather than an optional field on it: the two are imported in opposite
 * ways. A route module is `() => import(...)` and gets its own chunk; a search
 * module is a *static* import and is in the initial bundle. A single record
 * carrying both would make that difference invisible at the one place it
 * matters.
 *
 * `key` is the same `<pluginId>:<routeId>` the module registry uses, so the
 * runtime looks a route's schema up by the id everything else addresses it by.
 */
export interface ResolvedPluginRouteSearchModule {
  key: string;
  pluginId: string;
  routeId: string;
  searchEntry: string;
  specifier: string;
}

/**
 * One route's `validateSearch`, as the router will call it.
 *
 * `unknown` out rather than a schema type, for the same reason
 * {@link PluginRouteModuleLoader} returns `unknown`: the generated file uses
 * `satisfies`, so each entry keeps the real return type of the validator it
 * names and a consumer gets that type rather than this one.
 *
 * Total by contract. TanStack calls this during path matching, on whatever was
 * in the query string, and a throw there is a router error screen rather than a
 * page - so a validator normalises and clamps, it does not reject. See
 * {@link PluginRouteDefinition.searchEntry}.
 */
export type PluginRouteSearchValidator = (
  input: Record<string, unknown>,
) => unknown;

/**
 * Every eagerly-imported route search schema of an app, keyed by
 * {@link ResolvedPluginRouteSearchModule.key}.
 *
 * Sparse on purpose: a route appears here only by declaring a `searchEntry`, and
 * most do not. A missing key means "this route has no router-level search
 * schema", which is the ordinary case and not an error.
 */
export type PluginRouteSearchRegistry = Readonly<
  Record<string, PluginRouteSearchValidator>
>;
