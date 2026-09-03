/** What a crawler may do with a plugin page. */
export type PluginRouteRobots = "index, follow" | "noindex, nofollow";

export interface PluginRouteHead {
  /** The `<meta name="description">`, when the page has one. */
  description?: string;

  robots?: PluginRouteRobots;
  /** The page's own title, already translated. */
  title?: string;
}

export interface PluginRouteContext {
  locale: string;
}

/** What a plugin route's `load` is handed. */
export interface PluginRouteLoadArgs<TSearch = unknown> {
  context: PluginRouteContext;
  /** The route's own dynamic segments, e.g. `{ slug: "hello" }`. */
  params: Readonly<Record<string, string>>;
  /** Whatever `parseSearch` returned, or `{}` if the route declares none. */
  search: TSearch;
}

/** What a plugin route's `head` is handed. */
export interface PluginRouteHeadArgs<TData = unknown, TSearch = unknown> {
  loaderData?: TData;
  params: Readonly<Record<string, string>>;
  search: TSearch;
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

export interface PluginRouteOptions<TData = unknown, TSearch = unknown> {
  breadcrumb?:
    false | React.ComponentType<PluginRouteBreadcrumbProps<TData, TSearch>>;

  head?: (args: PluginRouteHeadArgs<TData, TSearch>) => PluginRouteHead;

  load?: (args: PluginRouteLoadArgs<TSearch>) => Promise<TData> | TData;

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
export interface PluginRoutePageModule<TData = unknown, TSearch = unknown> {
  default: React.FunctionComponent<PluginRoutePageProps<TData, TSearch>>;
  route?: PluginRouteOptions<TData, TSearch>;
}

/** A plugin route module that renders a frame - `layout()`. */
export interface PluginRouteLayoutModule<TData = unknown, TSearch = unknown> {
  default: React.FunctionComponent<
    PluginRoutePageProps<TData, TSearch> & { children: React.ReactNode }
  >;
  route?: PluginRouteOptions<TData, TSearch>;
}

export type PluginRouteModule<TData = unknown, TSearch = unknown> =
  | PluginRouteLayoutModule<TData, TSearch>
  | PluginRoutePageModule<TData, TSearch>;

export interface CheckedPluginRouteOptions {
  breadcrumb?: false | React.ComponentType<PluginRouteBreadcrumbProps<unknown>>;
  head?: (args: PluginRouteHeadArgs) => PluginRouteHead;
  load?: (args: PluginRouteLoadArgs) => unknown;
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
  "parseSearch",
] as const satisfies readonly (keyof CheckedPluginRouteOptions)[];

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

    if (key === "breadcrumb" && value === false) {
      options[key] = false;
      continue;
    }

    if (typeof value !== "function") {
      return fail(
        key === "breadcrumb"
          ? `declares \`route.breadcrumb\`, which must be a component or \`false\` (got ${typeof value}).`
          : `declares \`route.${key}\`, which must be a function (got ${typeof value}).`,
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
