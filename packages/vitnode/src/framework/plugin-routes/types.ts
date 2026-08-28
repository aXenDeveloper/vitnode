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
