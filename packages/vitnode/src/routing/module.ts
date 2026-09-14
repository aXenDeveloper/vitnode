/** What a crawler may do with a plugin page. */
export type PluginRouteRobots = "index, follow" | "noindex, nofollow";

export interface PluginRouteHead {
  /** The `<meta name="description">`, when the page has one. */
  description?: string;

  robots?: PluginRouteRobots;
  /** The page's own title, already translated. */
  title?: string;
}

/**
 * The least a route's `load` can count on, whoever mounts it.
 *
 * Deliberately small, and deliberately not the host's context: a route is handed
 * a *projection*, so a field a host happens to carry does not become public API
 * by accident - compiling today and arriving `undefined` on the next host.
 *
 * A framework layer widens this for the routes it mounts by passing its own
 * context type as `TContext` - see `@vitnode/core/tanstack/plugin-routes`, which
 * adds the query client every loader warms its data through, and the session a
 * guarded route has already been checked against.
 */
export interface PluginRouteContext {
  locale: string;
}

/**
 * Translates one of the route's declared messages.
 *
 * A plain function type, because nothing in `routing/` may reach into a
 * framework layer - `boundaries.test.ts` holds that line. The runtime builds it
 * from the namespaces the route declared in `messages`, which it has already
 * fetched by the time either `load` or `head` runs.
 *
 * Keys are full dotted paths, the namespace included:
 * `t("@acme/site-notes.home.title")`. A component writes
 * `useTranslations("@acme/site-notes.home")` and then `t("title")`; here there is
 * no component to scope, so the whole key is spelled out.
 */
export type PluginRouteTranslator = (
  key: string,
  values?: Record<string, unknown>,
) => string;

/** What a plugin route's `load` is handed. */
export interface PluginRouteLoadArgs<
  TSearch = unknown,
  TContext = PluginRouteContext,
> {
  context: TContext;
  /** The route's own dynamic segments, e.g. `{ slug: "hello" }`. */
  params: Readonly<Record<string, string>>;
  /** Whatever `parseSearch` returned, or `{}` if the route declares none. */
  search: TSearch;
  /** Translates one of the namespaces this route declared in `messages`. */
  t: PluginRouteTranslator;
}

/** What a plugin route's `head` is handed. */
export interface PluginRouteHeadArgs<TData = unknown, TSearch = unknown> {
  loaderData?: TData;
  params: Readonly<Record<string, string>>;
  search: TSearch;
  /**
   * Translates one of the namespaces this route declared in `messages`.
   *
   * `head` runs outside the React tree, so `useTranslations` cannot reach it -
   * this is the same strings by another door. The namespaces are already loaded
   * by the time `head` runs, so nothing here waits on the network.
   */
  t: PluginRouteTranslator;
}

export interface PluginRouteBreadcrumbProps<
  TData = undefined,
  TSearch = unknown,
> {
  loaderData: TData;
  /** This route's own dynamic segments, e.g. `{ productId: "42" }`. */
  params: Readonly<Record<string, string>>;

  search: TSearch;
}

/**
 * A crumb that renders several items rather than one label.
 *
 * Declared structurally rather than imported from the breadcrumb model, because
 * nothing in `routing/` may reach into a framework layer - see
 * `boundaries.test.ts`. The two shapes are checked against each other where they
 * meet, in `tanstack/plugin-routes/components.tsx`.
 */
export interface PluginRouteBreadcrumbGroup<
  TData = unknown,
  TSearch = unknown,
> {
  /**
   * A plain function type rather than `React.ComponentType`, so the props are
   * contravariant and a group written against `unknown` loader data can be
   * declared on a route that has some. `ComponentType` carries a `propTypes`
   * field that is *co*variant in the props, which would make every such group a
   * type error for no reason a reader could act on.
   */
  group: (
    props: PluginRouteBreadcrumbProps<TData, TSearch>,
  ) => null | React.ReactElement;
}

/**
 * What a route may say about its own crumb.
 *
 * `false` and `null` both mean "this route contributes nothing to the trail" and
 * are accepted alike, because one of them is what an author writes when the
 * answer is computed (`condition ? Crumb : null`) and the other is what they
 * write when it is not.
 */
export type PluginRouteBreadcrumbDeclaration<
  TData = unknown,
  TSearch = unknown,
> =
  | false
  | null
  | PluginRouteBreadcrumbGroup<TData, TSearch>
  | React.ComponentType<PluginRouteBreadcrumbProps<TData, TSearch>>;

export interface PluginRouteOptions<
  TData = unknown,
  TSearch = unknown,
  TContext = PluginRouteContext,
> {
  breadcrumb?: PluginRouteBreadcrumbDeclaration<TData, TSearch>;

  head?: (args: PluginRouteHeadArgs<TData, TSearch>) => PluginRouteHead;

  load?: (
    args: PluginRouteLoadArgs<TSearch, TContext>,
  ) => Promise<TData> | TData;

  /** Rendered when this route - or its loader - answers `notFound()`. */
  notFound?: React.ComponentType;

  parseSearch?: (input: unknown) => TSearch;
}

export interface PluginRoutePageProps<
  TData = undefined,
  TSearch = Record<string, never>,
> {
  loaderData: TData;

  navigate: (options: {
    resetScroll?: boolean;
    search: TSearch;
  }) => Promise<void>;
  /** The route's own dynamic segments, e.g. `{ slug: "hello" }`. */
  params: Readonly<Record<string, string>>;

  search: TSearch;
}

/** A plugin route module that renders a page - `page()` or `index()`. */
export interface PluginRoutePageModule<
  TData = unknown,
  TSearch = unknown,
  TContext = PluginRouteContext,
> {
  default: React.FunctionComponent<PluginRoutePageProps<TData, TSearch>>;
  route?: PluginRouteOptions<TData, TSearch, TContext>;
}

/** A plugin route module that renders a frame - `layout()`. */
export interface PluginRouteLayoutModule<
  TData = unknown,
  TSearch = unknown,
  TContext = PluginRouteContext,
> {
  default: React.FunctionComponent<
    PluginRoutePageProps<TData, TSearch> & { children: React.ReactNode }
  >;
  route?: PluginRouteOptions<TData, TSearch, TContext>;
}

export type PluginRouteModule<
  TData = unknown,
  TSearch = unknown,
  TContext = PluginRouteContext,
> =
  | PluginRouteLayoutModule<TData, TSearch, TContext>
  | PluginRoutePageModule<TData, TSearch, TContext>;

export interface CheckedPluginRouteOptions {
  breadcrumb?: PluginRouteBreadcrumbDeclaration;
  head?: (args: PluginRouteHeadArgs) => PluginRouteHead;
  /**
   * The context is `unknown` here and only here: this is the *runtime's* view of
   * a module it has just loaded and checked, and what the route was authored
   * against - the public projection, or one of the narrower ones a guard earns -
   * is a question the mount has already answered by the time it calls this.
   */
  load?: (args: PluginRouteLoadArgs<unknown, unknown>) => unknown;
  notFound?: React.ComponentType;
  parseSearch?: (input: unknown) => unknown;
}

/** A loaded plugin route module, checked. */
export interface CheckedPluginRouteModule {
  component: React.FunctionComponent<{ children?: React.ReactNode }>;
  /** Never `undefined` - a module that declares nothing gets an empty object. */
  route: CheckedPluginRouteOptions;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const OPTION_KEYS = [
  "breadcrumb",
  "head",
  "load",
  "notFound",
  "parseSearch",
] as const satisfies readonly (keyof CheckedPluginRouteOptions)[];

const isBreadcrumbGroup = (
  value: unknown,
): value is PluginRouteBreadcrumbGroup =>
  isRecord(value) && typeof value.group === "function";

export const readPluginRouteModule = (
  module: unknown,
  routeId: string,
): CheckedPluginRouteModule => {
  const fail = (reason: string): never => {
    throw new Error(
      `[VitNode plugin routes] The module for plugin route "${routeId}" ${reason}`,
    );
  };

  if (!isRecord(module)) {
    return fail("is not a module object.");
  }

  if (typeof module.default !== "function") {
    return fail(
      "does not export a component as its default export. A plugin route module is `export default MyPage`.",
    );
  }

  const declared = module.route;

  if (declared !== undefined && !isRecord(declared)) {
    return fail(
      "exports a `route` that is not an object. A plugin route module declares its behaviour as `export const route = { ... }`.",
    );
  }

  const options: Record<string, unknown> = {};

  for (const key of OPTION_KEYS) {
    const value = declared?.[key];

    if (value === undefined) continue;

    if (key === "breadcrumb") {
      if (value === false || value === null || isBreadcrumbGroup(value)) {
        options[key] = value;
        continue;
      }

      if (typeof value !== "function") {
        return fail(
          "declares `route.breadcrumb`, which must be a component, a breadcrumbGroup(), or `false` (got " +
            `${typeof value}).`,
        );
      }

      options[key] = value;
      continue;
    }

    if (typeof value !== "function") {
      return fail(
        `declares \`route.${key}\`, which must be a function (got ${typeof value}).`,
      );
    }

    options[key] = value;
  }

  return {
    // The one cast in the module, and the one the check above is standing in
    // for: `typeof === "function"` is everything a runtime can know about a
    // component, and the plugin's own `satisfies PluginRoutePageModule` is what
    // checked the props.
    component: module.default as CheckedPluginRouteModule["component"],
    route: options,
  };
};
