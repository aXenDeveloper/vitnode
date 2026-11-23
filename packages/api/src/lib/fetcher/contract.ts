/**
 * One endpoint an API plugin serves, with every field that identifies it
 * correlated: the plugin, the full module path, the route path, the method, and
 * the route definition arguments and responses are inferred from.
 */
export interface ApiEndpoint {
  readonly method: string;
  readonly module: string;
  readonly path: string;
  readonly plugin: string;
  readonly route: unknown;
}

/** One route, as much of one as resolving a call reads. */
export interface ApiRouteNode {
  readonly route: { readonly method: string; readonly path: string };
}

/**
 * A module, as much of one as resolving a call reads: its name, its children and
 * its route definitions.
 *
 * `modules` is `readonly unknown[]` rather than a list of modules, which keeps
 * this shallow. Route resolution checks a module against this shape at every
 * path segment, and a recursive one would turn each of those checks into a
 * structural comparison of a whole subtree.
 *
 * It is optional because that is how `buildModule` declares it, and matching
 * exactly is what lets the registry hold the module tuple a plugin already built
 * rather than a rebuilt copy: rebuilding creates a fresh object type per module
 * for resolution to compare against, where holding the original reuses types the
 * compiler resolved once, reading the plugin's declarations.
 *
 * Nothing here can reach `hono`, `contentModels`, `events`, `queueTasks`,
 * `webSockets`, `searchIndexers` or `messages`: a property is only resolved when
 * something asks for it, and nothing below asks.
 */
export interface ApiModuleContract {
  readonly modules?: readonly unknown[];
  readonly name: string;
  readonly routes: readonly ApiRouteNode[];
}

/**
 * What every registry entry is, shallowly.
 *
 * Deliberately not stated in terms of {@link ApiModuleContract}: this is checked
 * on the way into route resolution, and a recursive shape would turn one lookup
 * into a structural comparison of a plugin's whole module tree.
 */
export interface ApiPluginShape {
  readonly endpoints: unknown;
  readonly modulePaths: string;
  readonly modules: readonly unknown[];
  readonly pluginId: string;
}

type ChildrenOf<M extends ApiModuleContract> = Extract<
  M["modules"],
  readonly ApiModuleContract[]
>;

/**
 * Whether a module names itself and its routes with literals.
 *
 * `buildContentAdminModule` builds one module per content type from a runtime
 * `permissionModule` string and types its routes as the open `RouteConfig`, so
 * its name and paths are `string`. Letting one in would widen `module` and
 * `path` to `string` for the whole plugin, and every invalid call would compile.
 */
type IsTypedModule<M extends ApiModuleContract> = string extends M["name"]
  ? false
  : string extends M["routes"][number]["route"]["path"]
    ? false
    : true;

/**
 * Every module path below one module, built bottom-up.
 *
 * A subtree is spelled the same way wherever it is mounted, so keying this on
 * the module alone lets the compiler compute a subtree once and reuse it.
 * Threading a prefix down instead makes every node a distinct instantiation, and
 * the whole tree is walked again for each one.
 */
type ModulePathsOfModule<M extends ApiModuleContract> =
  M extends ApiModuleContract
    ? IsTypedModule<M> extends true
      ? `${M["name"]}/${ModulePathsOfModules<ChildrenOf<M>>}` | M["name"]
      : never
    : never;

type ModulePathsOfModules<Modules extends readonly ApiModuleContract[]> =
  ModulePathsOfModule<Modules[number]>;

type EndpointsOfRoutes<
  Plugin extends string,
  Module extends string,
  Routes extends readonly ApiRouteNode[],
> = Routes[number] extends infer R
  ? R extends { route: infer Route extends { method: string; path: string } }
    ? {
        method: Lowercase<Route["method"]>;
        module: Module;
        path: Route["path"];
        plugin: Plugin;
        route: Route;
      }
    : never
  : never;

type EndpointsOfModule<
  Plugin extends string,
  Prefix extends string,
  M extends ApiModuleContract,
> = M extends ApiModuleContract
  ? IsTypedModule<M> extends true
    ? | EndpointsOfModules<Plugin, `${Prefix}${M["name"]}/`, ChildrenOf<M>>
      | EndpointsOfRoutes<Plugin, `${Prefix}${M["name"]}`, M["routes"]>
    : never
  : never;

type EndpointsOfModules<
  Plugin extends string,
  Prefix extends string,
  Modules extends readonly ApiModuleContract[],
> = EndpointsOfModule<Plugin, Prefix, Modules[number]>;

/**
 * The whole type-level surface the fetcher needs from one API plugin.
 *
 * Every member is computed once, in the plugin's own `config.api.ts`, and the
 * registry stores the results - so no consumer walks a plugin's module tree to
 * answer a question about a call:
 *
 * - `modulePaths` is every module path the plugin serves, as one string union.
 *   Offering completions for `module` is then a single lookup, where deriving it
 *   meant re-walking the tree.
 * - `modules` is the module tuple the plugin already built. A call *resolves*
 *   through it, one step per path segment against a handful of siblings compared
 *   on `name` alone - cheaper than filtering a union of every endpoint the
 *   plugin serves.
 * - `endpoints` is every endpoint flattened, for {@link ApiRequest} and for
 *   anything enumerating an installation's API. Nothing on the path of an
 *   ordinary call reads it, so it stays unmaterialized until asked for.
 *
 * None of it reaches a plugin's Hono application, content models, event
 * listeners, queue tasks, WebSockets, search indexers or messages. Those are
 * runtime concerns, and resolving them is what made typing inside a call slow.
 */
export type ApiPluginContract<T> = T extends {
  modules: infer Modules extends readonly ApiModuleContract[];
  pluginId: infer Id extends string;
}
  ? {
      endpoints: EndpointsOfModules<Id, "", Modules>;
      modulePaths: ModulePathsOfModules<Modules>;
      modules: Modules;
      pluginId: Id;
    }
  : never;
