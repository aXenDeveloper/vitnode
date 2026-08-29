/**
 * What a plugin route *module* exports - the runtime half of the contract.
 *
 *     ./types    WHAT route exists, WHERE it lives, WHICH module owns it
 *     ./module   HOW that route behaves once its module has been fetched
 *
 * Two halves that are fetched at different times and must therefore be declared
 * in different places. The manifest is frozen into the application at build
 * time and read before anything is downloaded; a module is a lazily imported
 * chunk that arrives when somebody navigates. Anything the runtime has to know
 * *in order to decide whether to fetch the chunk* - the URL, the tree shape, the
 * guard, the strings to fetch alongside it - is manifest data. Everything else
 * is here.
 *
 * ## Why this is not `RouteOptions`
 *
 * Re-exporting TanStack Router's own route options as the plugin API would be
 * one line and would be a mistake. It would pin every plugin to that router's
 * exact generics - including the parent route type and the host's context type,
 * neither of which a plugin can name - so a router upgrade would be a breaking
 * change for every plugin in the ecosystem, and a VitNode app on any other
 * router could not load one at all. What is here instead is a VitNode-owned
 * shape: five optional members, all of them things a plugin page provably needs,
 * none of them a re-export.
 *
 * ## Import-free, and how
 *
 * `React.FunctionComponent` and `React.ReactNode` are reached through the UMD
 * global that `@types/react` declares, in type position only, so this module
 * still imports nothing at all and `boundaries.test.ts` still holds: the routing
 * layer is loadable in a Node process with no framework present, because every
 * reference here is erased before anything runs.
 *
 * ## Writing one
 *
 *     // plugins/blog/src/routes/post-page.tsx
 *     import { definePluginRoute } from "@vitnode/core/routing";
 *
 *     const PostPage = ({ loaderData }: PluginRoutePageProps<Post>) => (
 *       <article>{loaderData.title}</article>
 *     );
 *
 *     export const route = definePluginRoute({
 *       load: ({ context, params }) => fetchPost(context.locale, params.slug),
 *       head: ({ loaderData }) => ({ title: loaderData?.title }),
 *     });
 *
 *     export default PostPage;
 *
 * `definePluginRoute` rather than `satisfies PluginRoutePageModule["route"]`,
 * and the difference is not style: `satisfies` checks a value against a type and
 * never infers that type's arguments from the value, so the loader's return type
 * collapses and `loaderData?.title` fails to compile. See `./authoring`.
 *
 * The default export alone is still a complete module - it is what the
 * prototype's one plugin page exports today, and it keeps working untouched: a
 * component that declares no props is assignable to one that is offered them.
 */

/** What a crawler may do with a plugin page. */
export type PluginRouteRobots = "index, follow" | "noindex, nofollow";

/**
 * A plugin page's metadata, as the three fields a page actually sets.
 *
 * Structurally the host's own `RouteHeadOptions`
 * (`@vitnode/core/tanstack/metadata`), so the runtime hands this straight to
 * `routeHead` and a plugin's title goes through the same `"<page> - <site>"`
 * rule every VitNode page's does. Deliberately *not* that type: this layer may
 * not import it, and a plugin that could return arbitrary head elements would be
 * a plugin that could inject a script tag into its host.
 *
 * There is no Open Graph, no canonical link and no JSON-LD here, and that is a
 * decision rather than an omission: a full metadata API is a stage of its own,
 * and three fields is what the migrated routes have needed.
 */
export interface PluginRouteHead {
  /** The `<meta name="description">`, when the page has one. */
  description?: string;
  /**
   * Omit where a parent layout already declares it - the router merges the
   * `head` of every matched route and prefers the deepest, so a child inherits
   * by saying nothing.
   */
  robots?: PluginRouteRobots;
  /** The page's own title, already translated. */
  title?: string;
}

/**
 * The least a host promises a plugin route's loader.
 *
 * The locale, because a loader that fetches anything user-facing needs to know
 * which language it is fetching, and because the public URL is the only place
 * that answer comes from.
 *
 * A host extends this - a TanStack Start app adds the `QueryClient` its loader
 * reads through and the auth state its guard already resolved - and binds the
 * generic below to the extended shape. It is a base rather than the whole thing
 * because those additions are typed by packages this layer may not import.
 */
export interface PluginRouteContextBase {
  locale: string;
}

/** What a plugin route's `load` is handed. */
export interface PluginRouteLoadArgs<
  TContext extends PluginRouteContextBase = PluginRouteContextBase,
  TSearch = unknown,
> {
  context: TContext;
  /** The route's own dynamic segments, e.g. `{ slug: "hello" }`. */
  params: Readonly<Record<string, string>>;
  /** Whatever `validateSearch` returned, or `{}` if the route declares none. */
  search: TSearch;
}

/** What a plugin route's `head` is handed. */
export interface PluginRouteHeadArgs<TData = unknown, TSearch = unknown> {
  /**
   * Optional because `head` runs once *before* the loader has resolved. Spread
   * it rather than branching on it:
   *
   *     head: ({ loaderData }) => ({ robots: "index, follow", ...loaderData })
   */
  loaderData?: TData;
  params: Readonly<Record<string, string>>;
  search: TSearch;
}

/**
 * The behaviour a plugin route module may declare, and the whole of it.
 *
 * Five members, every one optional, every one traced to something a migrated
 * VitNode page does today.
 */
export interface PluginRouteOptions<
  TContext extends PluginRouteContextBase = PluginRouteContextBase,
  TData = unknown,
  TSearch = unknown,
> {
  /**
   * What this route contributes to the shell's breadcrumb area.
   *
   * A **component**, not an element, because the label is translated and on a
   * dynamic route comes from the loader - so it has to be able to use hooks, and
   * the runtime is the only thing that can decide where to mount it. The deepest
   * matched route that declares one wins, which is Stage 8's rule
   * (`breadcrumbOf`) and therefore the same rule the host's own routes follow.
   *
   * There is deliberately no pathname-to-label registry anywhere: a route
   * declares its own crumb, next to its own component.
   */
  breadcrumb?: React.FunctionComponent;
  /**
   * The page's title, description and robots directive - translated, and
   * usually read off `loaderData` so the `<title>` and the `<h1>` are the same
   * string by construction.
   */
  head?: (args: PluginRouteHeadArgs<TData, TSearch>) => PluginRouteHead;
  /**
   * Everything the route needs before it renders.
   *
   * Runs before React, on the server and in the browser, so a page that awaits
   * its data here is a page whose first byte of HTML already contains it. Reuse
   * the canonical query contracts - `context.queryClient.ensureQueryData(...)`
   * against the same options the component reads back - rather than fetching
   * into local state: a loader that warms a different key than its component
   * reads is a render that starts empty and fills in a round trip later.
   *
   * The host's API boundary is unchanged. A plugin's reads go to Hono the way
   * every other read does; this is where they are *awaited*, not a second
   * transport.
   *
   * Its return type flows into `head`'s `loaderData` and into the component's
   * props, so one object serves all three.
   */
  load?: (
    args: PluginRouteLoadArgs<TContext, TSearch>,
  ) => Promise<TData> | TData;
  /**
   * The route's URL contract: what this page will accept in its query string.
   *
   * **Must be total.** It normalises, it does not reject - a hand-edited or
   * pasted query string should render the page it would have rendered anyway,
   * because throwing here turns `?first=abc` into a router error screen. Return
   * only parameters this route recognises; anything else must not be carried
   * forward into a request.
   *
   * When a route declares one, the runtime re-runs `load` whenever the validated
   * search changes. That is deliberately not configurable: a loader that did not
   * re-run would serve the first result set forever, and the cost of an extra
   * cached read is smaller than the cost of a stale page.
   */
  validateSearch?: (input: unknown) => TSearch;
}

/**
 * What a plugin route's component is handed, whichever kind of module it is.
 *
 * The same three names `load` and `head` receive, so one vocabulary carries
 * across all three seams of a route: an author writes `({ params })` in the
 * loader, `({ loaderData, params })` in `head` and `({ loaderData, params })` in
 * the component, and never has to learn which spelling belongs where.
 *
 * An envelope rather than the loader's return spread flat, and the reason is
 * that a spread has no answer for the cases: a loader that returns a string has
 * nothing to spread, and a loader that happens to return a `children` key would
 * displace the routes rendered inside a layout.
 *
 * A component that needs none of it still declares no props - `() => <Page />`
 * is assignable to a component type that supplies these, and stays the whole of
 * a simple plugin page.
 */
export interface PluginRoutePageProps<
  TData = undefined,
  TSearch = Record<string, never>,
> {
  /**
   * Exactly what `load` returned, or `undefined` for a module that declares no
   * loader.
   *
   * **Not optional**, unlike the `loaderData` on {@link PluginRouteHeadArgs},
   * and the asymmetry is real rather than an oversight: `head` runs on passes
   * where the loader has not resolved, and a match does not render until its
   * loader has. By the time this component exists the data is in hand.
   */
  loaderData: TData;
  /** The route's own dynamic segments, e.g. `{ slug: "hello" }`. */
  params: Readonly<Record<string, string>>;
  /** Whatever `validateSearch` returned - never raw query parameters. */
  search: TSearch;
}

/** A plugin route module that renders a page - `kind: "page"`. */
export interface PluginRoutePageModule<
  TContext extends PluginRouteContextBase = PluginRouteContextBase,
  TData = unknown,
  TSearch = unknown,
> {
  /**
   * The page.
   *
   * A default export because that is how every VitNode plugin page already
   * exports itself, and because it is the one name a generated registry can rely
   * on without being told.
   *
   * It renders no `<main>`: the route's area puts it inside the application
   * shell, and the shell owns the document's one `main` landmark. A page owns
   * its container - width, padding, vertical rhythm - and nothing above it.
   */
  default: React.FunctionComponent<PluginRoutePageProps<TData, TSearch>>;
  route?: PluginRouteOptions<TContext, TData, TSearch>;
}

/** A plugin route module that renders a frame - `kind: "layout"`. */
export interface PluginRouteLayoutModule<
  TContext extends PluginRouteContextBase = PluginRouteContextBase,
  TData = unknown,
  TSearch = unknown,
> {
  /**
   * The frame, which renders its children where they belong.
   *
   * `children` as a prop rather than an `<Outlet />` the layout imports, which
   * is the only thing that keeps a layout framework-neutral: an `Outlet` is a
   * router's, and a plugin that imported one could be installed into exactly one
   * kind of application. It is the same shape as a Next.js `layout.tsx`, so a
   * plugin that ships both writes the frame once.
   */
  default: React.FunctionComponent<
    PluginRoutePageProps<TData, TSearch> & { children: React.ReactNode }
  >;
  route?: PluginRouteOptions<TContext, TData, TSearch>;
}

/**
 * Either kind of module, for code that has not yet looked at the manifest.
 *
 * The two differ only in what their component is handed, and which one a module
 * must be is decided by its route's `kind` - which the runtime knows before it
 * loads the module.
 */
export type PluginRouteModule<
  TContext extends PluginRouteContextBase = PluginRouteContextBase,
  TData = unknown,
  TSearch = unknown,
> =
  | PluginRouteLayoutModule<TContext, TData, TSearch>
  | PluginRoutePageModule<TContext, TData, TSearch>;

/**
 * A module's declared behaviour, once it has been checked rather than trusted.
 *
 * Every callable is typed at its widest here, because the check is `typeof
 * value === "function"` and nothing more: a module arrives from a registry whose
 * loaders are `() => Promise<unknown>` on purpose, and no amount of casting at
 * this boundary can make a plugin's `load` provably take the host's context.
 * The runtime applies the arguments it promised and the plugin's own `satisfies`
 * is what checked that they line up.
 */
export interface CheckedPluginRouteOptions {
  breadcrumb?: React.FunctionComponent;
  head?: (args: PluginRouteHeadArgs) => PluginRouteHead;
  load?: (args: PluginRouteLoadArgs) => unknown;
  validateSearch?: (input: unknown) => unknown;
}

/** A loaded plugin route module, checked. */
export interface CheckedPluginRouteModule {
  /**
   * The module's default export.
   *
   * Typed to accept `children` so one shape covers both kinds; a page component
   * that declares no props is assignable to it and simply ignores them.
   */
  component: React.FunctionComponent<{ children?: React.ReactNode }>;
  /** Never `undefined` - a module that declares nothing gets an empty object. */
  route: CheckedPluginRouteOptions;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Every member of {@link PluginRouteOptions}, and which of them are functions.
 *
 * A list rather than four `if`s, so adding a member to the contract is one entry
 * here instead of a check somebody forgets to write. `breadcrumb` is included:
 * it is a component, which is a function, and a plugin that exported an *element*
 * by mistake would otherwise reach React as an invalid element type three frames
 * from the plugin that caused it.
 */
const OPTION_KEYS = [
  "breadcrumb",
  "head",
  "load",
  "validateSearch",
] as const satisfies readonly (keyof CheckedPluginRouteOptions)[];

/**
 * A loaded module, checked and narrowed - or an error naming the plugin route.
 *
 * The registry's loaders are typed `() => Promise<unknown>` deliberately: what a
 * module is expected to export is not the registry's contract. This is where
 * that `unknown` becomes something a router can be handed, and it is *checked*
 * rather than asserted, because the failure it prevents is otherwise React's
 * "type is invalid" from inside a lazy component, with nothing in the message
 * naming the plugin.
 *
 * Pure and total in the useful sense: a valid module in, a checked module out;
 * anything else throws with the route id in it. It reads nothing but the two
 * names the contract defines, so a module that also exports helpers, constants
 * or a test fixture is fine.
 */
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
