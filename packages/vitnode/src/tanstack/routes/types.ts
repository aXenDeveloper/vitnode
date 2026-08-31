import type { AnyRoute } from "@tanstack/react-router";

import type { ContentFrontendRegistry } from "../../content/admin/registry";
import type { RouteHeadOptions, RouteHeadResult } from "../metadata";

/**
 * The host's `head` rule, bound to its own site name.
 *
 * The same binding the plugin route runtime takes, for the same reason: a
 * package cannot know what a site is called, so `"<page> - <site>"` is applied
 * by a function the application owns. `createRouteHead(metadata)` produces it
 * and `src/lib/page-head.ts` is where every VitNode app keeps it.
 */
export type CorePageHead = (options?: RouteHeadOptions) => RouteHeadResult;

/** What a core route is built with. */
export interface CoreRouteContext {
  /** The host's `pageHead`, so every title ends with the site's own name. */
  pageHead: CorePageHead;
  /**
   * The route this screen hangs from - always a **pathless** container, so a
   * screen's `path` is its full public URL and nothing prefixes it.
   */
  parentRoute: AnyRoute;
}

/**
 * One screen, as the function that builds it.
 *
 * A factory rather than a route object, because `createRoute` needs its parent
 * and the parent does not exist until the host hands a shell over.
 */
export type CoreRouteFactory<
  TContext extends CoreRouteContext = CoreRouteContext,
> = (context: TContext) => AnyRoute;

/** What the Content Engine's splat needs beyond the usual two. */
export interface CoreAdminRouteContext extends CoreRouteContext {
  /**
   * The application's Content Engine registry - which content types the plugins
   * it configured register, and the components that edit them.
   *
   * Injected for the same reason `pageHead` is: it is per-installation. The app
   * builds it from its generated `src/content-registry.gen.ts`, one literal
   * import per configured plugin, and only the Content Engine's splat reads it.
   */
  contentRegistry: ContentFrontendRegistry;
}

/**
 * The router's loader arguments, narrowed at the one place they arrive.
 *
 * `getParentRoute` returns an `AnyRoute` - a core screen is mounted under a
 * container built from the *host's* shell, so this package cannot name that
 * route's type - and TanStack propagates the `any` into `context` and `search`
 * for every route built from it. Each screen would then receive `any` where it
 * declared a real type: it compiles, and it is exactly the hole a lint rule
 * exists to refuse.
 *
 * So the narrowing happens here, with a name on it, rather than once per screen
 * implicitly. Neither of these changes a value; both say which type the router
 * could not work out for itself. `TSearch` and `TContext` are inferred from the
 * call site - a screen's own `staffRouteParams(...)` or `loadDiscoverRoute({...})`
 * names the type it wants - so a screen that changes its loader's shape changes
 * this with it.
 */
export const routeSearch = <TSearch>(search: unknown): TSearch =>
  search as TSearch;

/** See {@link routeSearch}. */
export const routeContext = <TContext>(context: unknown): TContext =>
  context as TContext;
