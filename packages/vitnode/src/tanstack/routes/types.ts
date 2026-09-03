import type { AnyRoute } from "@tanstack/react-router";

import type { ContentFrontendRegistry } from "../../content/admin/registry";
import type { LocaleRouting } from "../../lib/i18n/locale-routing";
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
   * The application's Content Engine registry, behind a literal dynamic import.
   *
   * Injected for the same reason `pageHead` is: it is per-installation. The app
   * builds it from its generated `src/content-registry.gen.ts`, one literal
   * import per configured plugin, and only the Content Engine's splat reads it.
   *
   * ## Why a thunk rather than the registry itself
   *
   * Because the value is enormous and every page of the application would pay
   * for it. A registry holds each configured plugin's field components, table
   * cells and form layouts, and building one reaches `@vitnode/core/content` -
   * which is the whole Content Engine, `zod` included. Handed over as a value,
   * that graph is evaluated in the module that composes the route tree, which
   * is the client entry: measured on vitnode.com it was `zod`, both plugins'
   * admin registrations, the content form primitives and `react-hook-form`,
   * downloaded before the front page could paint.
   *
   * A `() => import("./lib/content-registry")` is resolved by the bundler into
   * a chunk of its own and awaited by the one loader that needs it, which runs
   * only on `/admin/content/*`. Nothing about the route's identity depends on
   * it: the path, the search contract and the crumb are all still eager, and
   * the permission check still runs inside the loader, before anything renders.
   */
  loadContentRegistry: () => Promise<ContentFrontendRegistry>;
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

/**
 * What a screen that performs a navigation nobody clicked is built with.
 *
 * One field more than the usual two, and it is the reason the auth screens were
 * the last to move: a sign-in navigates to a path a *visitor* supplied through
 * `?returnTo=`. Deciding what the router should be handed means stripping the
 * locale prefix the route tree does not carry - and which languages exist is the
 * installation's answer, not this package's.
 *
 * So the app's own locale rule is injected, exactly as `pageHead` and
 * `contentRegistry` are, and `createAuthNavigation` builds both halves of the
 * navigation from it. See `@vitnode/core/tanstack/auth`.
 */
export interface CoreAuthRouteContext extends CoreRouteContext {
  localeRouting: Pick<LocaleRouting, "deLocalizeUrl">;
}

/** One screen that navigates on the visitor's behalf. */
export type CoreAuthRouteFactory = CoreRouteFactory<CoreAuthRouteContext>;
