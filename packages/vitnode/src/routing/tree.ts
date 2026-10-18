import type { PageCacheSetting } from "../page-cache/policy";
import type {
  PluginRouteArea,
  PluginRouteKind,
  PluginRouteRequirement,
} from "./types";

const LAZY_BRAND = Symbol.for("vitnode.plugin-routes.lazy");
const DECLARATION_BRAND = Symbol.for("vitnode.plugin-routes.declaration");

export interface PluginRouteLazyComponent<TModule = unknown> {
  readonly [LAZY_BRAND]: true;
  readonly load: () => Promise<TModule>;
}

/**
 * Marks a route's page module as lazily loaded, so it gets its own chunk.
 * Every `component` must be wrapped in it.
 *
 * @example
 * ```ts
 * component: lazy(() => import("./pages/post-page")),
 * ```
 */
export const lazy = <TModule>(
  load: () => Promise<TModule>,
): PluginRouteLazyComponent<TModule> => ({
  [LAZY_BRAND]: true,
  load,
});

export const isPluginRouteLazyComponent = (
  value: unknown,
): value is PluginRouteLazyComponent => {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Partial<PluginRouteLazyComponent>;

  return candidate[LAZY_BRAND] === true && typeof candidate.load === "function";
};

type ModuleSearchOf<TModule> = TModule extends {
  default: (props: infer TProps) => unknown;
}
  ? TProps extends { search: infer TSearch }
    ? TSearch
    : Record<string, unknown>
  : Record<string, unknown>;

export type PluginRouteSearchSchema<TModule> = (
  input: Record<string, unknown>,
) => ModuleSearchOf<TModule>;

interface PluginRouteDeclarationShared<TModule> {
  component:
    | '`component` must be lazy(() => import("./pages/my-page")): a component imported into routes.ts is in the initial bundle, so its page cannot be split into a chunk of its own.'
    | PluginRouteLazyComponent<TModule>;
  /**
   * Translation namespaces the route renders, as dotted paths into the
   * plugin's message tree (e.g. `"@vitnode/blog.post"`), so only those strings
   * are downloaded.
   */
  messages?: readonly string[];
  /**
   * Drawn while this route loads.
   *
   * Imported directly rather than named through `lazy()`, because a router needs
   * it *before* the page's own chunk has arrived - so it is part of the initial
   * bundle, and a heavy one is worth a second thought.
   */
  pendingComponent?: React.FunctionComponent;
  /**
   * `false` stops hovering a link from running this route's loader early.
   * Children of a `layout()` inherit it.
   */
  preload?: boolean;
  /**
   * Who may open the route, checked before its chunk downloads:
   * `"authenticated"` redirects guests to `/login`, `"guest"` redirects
   * signed-in users away, `"admin-guest"` sends staff with an AdminCP session
   * into the AdminCP. Not allowed under `area: "admin"`, and a route with
   * `requires` cannot be cached.
   */
  requires?: PluginRouteRequirement;
}

export type PluginRouteEagerComponentRejected = Exclude<
  PluginRouteDeclarationShared<unknown>["component"],
  object
>;

/** Either spelling of a `component` field: the lazy one, or the rejection. */
export type PluginRouteComponent<TModule = unknown> =
  PluginRouteDeclarationShared<TModule>["component"];

export interface PluginRoutePageOptions<
  TModule,
> extends PluginRouteDeclarationShared<TModule> {
  /**
   * The shell the page renders in: `"main"` (default, the public layout),
   * `"blank"` (no chrome) or `"admin"` (AdminCP, behind the staff session).
   * Top-level routes only - nested routes use their layout's.
   */
  area?: PluginRouteArea;
  /**
   * Reuse this page's server-rendered HTML for every visitor, in seconds:
   * `{ maxAge: 300, staleWhileRevalidate: 60 }`. Off unless declared, and the
   * host application can change or remove it through `vitNodeConfig.pageCache`.
   * The page then renders without the visitor's session, so it may only show
   * what is safe to share.
   */
  cache?: PageCacheSetting;
  /**
   * Parses the URL's query string before the page chunk loads; its return
   * type is the page's `search` prop.
   */
  search?: PluginRouteSearchSchema<TModule>;
}

export interface PluginRouteIndexOptions<
  TModule,
> extends PluginRouteDeclarationShared<TModule> {
  /** See {@link PluginRoutePageOptions.cache}. */
  cache?: PageCacheSetting;
  /** See {@link PluginRoutePageOptions.search}. */
  search?: PluginRouteSearchSchema<TModule>;
}

export interface PluginRouteLayoutOptions<
  TModule,
> extends PluginRouteDeclarationShared<TModule> {
  /** See {@link PluginRoutePageOptions.area}. */
  area?: PluginRouteArea;
  /** Routes rendered inside this layout; paths are relative to it. */
  children: readonly PluginRouteDeclaration[];
}

export interface PluginRouteDeclaration {
  readonly area: PluginRouteArea | undefined;
  readonly cache: unknown;
  readonly children: readonly PluginRouteDeclaration[] | undefined;
  readonly component: unknown;
  readonly [DECLARATION_BRAND]: true;
  readonly isIndex: boolean;
  readonly kind: PluginRouteKind;
  readonly messages: readonly string[] | undefined;
  readonly path: null | string;
  readonly pendingComponent: unknown;
  readonly preload: unknown;
  readonly requires: PluginRouteRequirement | undefined;
  readonly search: unknown;
}

/** A plugin's route tree, as exported from its `src/routes.ts`. */
export type PluginRoutes = readonly PluginRouteDeclaration[];

export interface PluginRouteDeclarationSource {
  pluginId: string;
  routes: PluginRoutes;
}

export const isPluginRouteDeclaration = (
  value: unknown,
): value is PluginRouteDeclaration =>
  typeof value === "object" &&
  value !== null &&
  (value as Partial<PluginRouteDeclaration>)[DECLARATION_BRAND] === true;

interface PluginRouteDeclarationOptions {
  area?: PluginRouteArea;
  cache?: unknown;
  children?: readonly PluginRouteDeclaration[];
  component: unknown;
  messages?: readonly string[];
  pendingComponent?: unknown;
  preload?: unknown;
  requires?: PluginRouteRequirement;
  search?: unknown;
}

const declaration = (
  options: PluginRouteDeclarationOptions & {
    isIndex: boolean;
    kind: PluginRouteKind;
    path: null | string;
  },
): PluginRouteDeclaration => ({
  [DECLARATION_BRAND]: true,
  area: options.area,
  cache: options.cache,
  children: options.children,
  component: options.component,
  isIndex: options.isIndex,
  kind: options.kind,
  messages: options.messages,
  path: options.path,
  pendingComponent: options.pendingComponent,
  preload: options.preload,
  requires: options.requires,
  search: options.search,
});

/**
 * A page at `path`. Use `:name` for a dynamic segment (`/blog/:slug`) and
 * `*` for a trailing splat.
 */
export const page = <TModule>(
  path: string,
  options: PluginRoutePageOptions<TModule>,
): PluginRouteDeclaration =>
  declaration({
    ...(options as PluginRouteDeclarationOptions),
    isIndex: false,
    kind: "page",
    path,
  });

/** The page rendered at its parent `layout()`'s own path. */
export const index = <TModule>(
  options: PluginRouteIndexOptions<TModule>,
): PluginRouteDeclaration =>
  declaration({
    ...(options as PluginRouteDeclarationOptions),
    isIndex: true,
    kind: "page",
    path: null,
  });

/** A shared UI frame around `children`, rendered for every route under `path`. */
export const layout = <TModule>(
  path: string,
  options: PluginRouteLayoutOptions<TModule>,
): PluginRouteDeclaration =>
  declaration({
    ...(options as PluginRouteDeclarationOptions),
    isIndex: false,
    kind: "layout",
    path,
  });

/**
 * Declares the URLs a plugin owns, exported as `routes` from its
 * `src/routes.ts`. The host app turns the tree into lazy TanStack Start
 * routes; pages never import a router themselves.
 *
 * @throws Error When `routes` is not an array or an entry was not built
 * with `page()`, `layout()` or `index()`.
 *
 * @example
 * ```ts
 * import { definePluginRoutes, lazy, page } from "@vitnode/core/routing";
 *
 * export const routes = definePluginRoutes([
 *   page("/blog/:slug", {
 *     component: lazy(() => import("./pages/post-page")),
 *     messages: ["@vitnode/blog.post"],
 *   }),
 * ]);
 * ```
 */
export const definePluginRoutes = (routes: PluginRoutes): PluginRoutes => {
  if (!Array.isArray(routes)) {
    throw new Error(
      "[VitNode plugin routes] definePluginRoutes takes an array of routes built with page(), layout() or index().",
    );
  }

  routes.forEach((route: unknown, position) => {
    if (isPluginRouteDeclaration(route)) return;

    throw new Error(
      `[VitNode plugin routes] definePluginRoutes received something at position ${String(position)} that was not built with page(), layout() or index(). Wrap every route in one of those - a plain object cannot carry the kind of route it is.`,
    );
  });

  return routes;
};

/**
 * {@link definePluginRoutes}, under the name core uses for its own tree.
 *
 * One function, two spellings, because "plugin" is wrong on exactly one caller:
 * `@vitnode/core` declares its pages with this same vocabulary and is not a
 * plugin. Everything downstream - the compiler, the manifest, the mount - treats
 * the two the same, which is the whole point of core going through this door.
 */
export const defineRoutes = definePluginRoutes;
