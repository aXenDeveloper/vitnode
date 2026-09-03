import type { AnyRoute } from "@tanstack/react-router";

import { createRoute, redirect } from "@tanstack/react-router";

import type {
  CoreAuthRouteContext,
  CoreAuthRouteFactory,
  CorePageHead,
  CoreRouteFactory,
} from "../types";

import { LOGIN_PATH, returnToFor } from "../../auth/redirects";
import { ensureAuthState } from "../../auth/session-query";
import { canAccessAuthenticatedRoute } from "../../auth/state";
import { GuardedOutlet } from "../../pending/guard-pending";
import { routeContext } from "../types";
import { coreAuthRoutes } from "./auth";
import { coreDiscoveryRoutes } from "./discovery";
import { myFilesRoute } from "./files";
import { notFoundRoute } from "./not-found";
import { settingsRoute } from "./settings";
import { ssoCallbackRoute } from "./sso";

export type {
  CoreAuthRouteContext,
  CoreAuthRouteFactory,
  CorePageHead,
  CoreRouteContext,
  CoreRouteFactory,
} from "../types";

/**
 * The pathless route core's own public screens are mounted under.
 *
 * Pathless, so it contributes no URL segment - `/discover` is served at
 * `/discover` - and identifiable, which is what makes the composition
 * idempotent: the subtree is one child of the main shell, so re-running it
 * replaces itself instead of appending a second copy of every screen. In dev,
 * Vite re-evaluates the module that composes the tree without re-evaluating
 * `routeTree.gen.ts`, and the route it mutates is the same object.
 */
export const CORE_MAIN_ROUTES_ROUTE_ID = "_core-main";

/**
 * The pathless route core's **signed-in** screens are mounted under, and the
 * guard they sit behind.
 *
 * Nested inside the public container rather than beside it, so `/files` and the
 * settings subtree inherit the guard by being its children and cannot forget to
 * check a session. Not one of the screens below contains the word "session".
 */
export const CORE_AUTHENTICATED_ROUTES_ROUTE_ID = "_core-authenticated";

/**
 * Core's public screens - everything a signed-out visitor may open.
 *
 * The four auth screens are in this list rather than in `withCoreRootRoutes`,
 * and that is the one placement worth reading twice. An auth card is a page on
 * the public site: it wants the site header above it (its own layout already
 * reserves the `4rem` that header occupies), the same `<main>` landmark, and the
 * way back to the front page that the header is. Only the AdminCP's own sign-in
 * is genuinely shell-less, because it has to sit outside the AdminCP shell or
 * that shell's guard would send a denied visitor into a route that sends them
 * back.
 *
 * `notFoundRoute` is last for the reader rather than for the router - a splat
 * ranks below every other segment kind wherever it is declared - and it is here
 * for the same reason the auth screens are: a 404 should look like the site it
 * could not find a page on. See {@link notFoundRoute} for why an unmatched URL
 * needs a *route* rather than a `notFoundComponent` on the shell.
 */
const CORE_PUBLIC_ROUTES: CoreAuthRouteFactory[] = [
  ...coreDiscoveryRoutes,
  ...coreAuthRoutes,
  ssoCallbackRoute,
  notFoundRoute,
];

/** Core's screens that require a signed-in visitor. */
const CORE_AUTHENTICATED_ROUTES: CoreRouteFactory[] = [
  myFilesRoute,
  settingsRoute,
];

/**
 * The boundary every page that requires a signed-in visitor sits under.
 *
 * ## Why the check is in `beforeLoad`
 *
 * It runs before the route's loader and long before React, so an anonymous
 * visitor never receives a byte of a protected page - not a flash, not a
 * hydration, not a `useEffect` that redirects afterwards. A component-level
 * check would render the page first and then take it away, which is both a
 * visible flicker and, on the server, protected markup already written into the
 * stream.
 *
 * ## A failed session read is not a signed-out visitor
 *
 * `ensureAuthState` rejects when the session could not be read - a rate limit, a
 * 500, an API that is not listening - and that rejection is deliberately left to
 * propagate. Only `canAccessAuthenticatedRoute` answering `false`, on a session
 * the API actually returned, sends anybody to the login page. Catching the
 * rejection and redirecting would sign a visitor out because of an outage, which
 * is precisely the bug this shape exists to prevent.
 *
 * ## What it is not
 *
 * A navigation guard, and only that. Every private read is authorized by Hono
 * from the session cookie, in the API's own handlers - so a visitor who edits a
 * cached session in devtools gets a page shell and an API that still refuses
 * them. Nothing here is, or may become, the security boundary.
 *
 * ## What children receive
 *
 * `beforeLoad`'s return merges into the context of everything below, so a child
 * route reads `context.auth` already narrowed to the signed-in half of the union
 * - `auth.user` is non-null without a check. It is the same object the guard
 * decided on, from the same cache entry, so a page cannot disagree with the
 * guard that let it render.
 */
const authenticatedContainer = (parentRoute: AnyRoute): AnyRoute =>
  createRoute({
    getParentRoute: () => parentRoute,
    id: CORE_AUTHENTICATED_ROUTES_ROUTE_ID,
    beforeLoad: async ({ context, location }) => {
      const auth = await ensureAuthState(
        routeContext<{
          queryClient: Parameters<typeof ensureAuthState>[0];
        }>(context).queryClient,
      );

      if (!canAccessAuthenticatedRoute(auth)) {
        // TanStack Router's own control-flow signal: `redirect()` returns a
        // typed redirect object that the router catches and turns into a
        // navigation (or, during SSR, a 302). Throwing it is what stops the
        // guard - and what narrows the code below.
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw redirect({
          search: {
            // The *internal* path - the locale has already been stripped by the
            // rewrite - so the value that round-trips through the login URL
            // carries no language, and the prefix is written back exactly once,
            // by the rewrite, when the router builds the way home.
            returnTo: returnToFor(location),
          },
          to: LOGIN_PATH,
        });
      }

      return { auth };
    },
    /**
     * The guard's own wait, given the shape of the page it is guarding.
     *
     * Router core will not open a pending window for a *retained* match, and
     * once a visitor is inside this container every navigation within it is one
     * - so the session read above ran with the previous page still on screen
     * and nothing to say so. `RouteGuardPending` renders the destination's own
     * `pendingComponent` for exactly as long as that read takes, on the router's
     * own threshold, and hands back to the router the moment it opens its
     * window - with the same component, so nothing on screen changes.
     */
    component: GuardedOutlet,
  });

/**
 * Mounts core's own public screens on a route tree, and hands the tree back.
 *
 * ## What this replaced
 *
 * Route files in every application. `apps/web/src/routes/_main/` held one
 * `createFileRoute` per screen - discover, search, my files, the settings frame
 * and its four panels, plus the pathless guard above them - and every one of
 * them was wiring: the loader, the component, the search normaliser and the
 * breadcrumb all came from `@vitnode/core`, and the file existed only so a
 * file-based router would see a path. So an app that installed VitNode carried a
 * copy of VitNode's own routing table, the scaffold shipped that copy to every
 * new project, and core adding a screen meant an edit in each of them.
 *
 * There is one implementation now, in the package that owns the screens. An
 * application mounts them the way it already mounts a plugin's:
 *
 *     const routeTree = withCoreMainRoutes(routeTree, {
 *       localeRouting,
 *       mountUnder: mainShellRoute,
 *       pageHead,
 *     })
 *
 * ## Why `localeRouting` is injected and `pageHead` is not enough
 *
 * The auth screens. A sign-in performs a navigation nobody clicked, to a path a
 * *visitor* supplied through `?returnTo=`. The route tree carries no locale, so
 * what the router is handed must not either - and stripping the prefix means
 * knowing which prefixes exist, which is the installation's answer and not this
 * package's. See `createAuthNavigation` in `@vitnode/core/tanstack/auth`; the
 * app's own `localeRouting` is the same object its router's `rewrite` uses, so
 * the strip and the write-back are one rule running in two directions.
 *
 * ## Why not declared as plugin routes
 *
 * Because these need options a lazily-imported module cannot provide.
 * `validateSearch` runs during path matching, before any chunk is fetched, and
 * `/search`, `/files` and the AdminCP's lists keep their state in the query
 * string. A `beforeLoad` guard has the same problem one level up: a requirement
 * that lived in a lazy module could only be read by downloading the page it was
 * meant to withhold. Core is not a third-party package and does not need that
 * layer's guarantees about untrusted plugins; what it needs is the router's own
 * option set, which is what a code-based route is.
 *
 * ## What an application still owns
 *
 * Its home page, and the shell. `_main/index.tsx` is the site's own front page -
 * nothing about it is VitNode's - and it is also the one file-based child
 * `_main.tsx` needs in order to exist: a pathless layout with no file children is
 * dropped from the generated route tree and collapses to `/`.
 *
 * What it no longer owns is the 404. `__root`'s `notFoundComponent` is still
 * declared and still correct as a last resort, but the URL a visitor actually
 * mistypes is answered by {@link notFoundRoute} in this container, inside the
 * shell - so the screen that says a page is missing is not itself missing the
 * site.
 *
 * ## Idempotent, and a good neighbour
 *
 * `addChildren` replaces a route's children and mutates in place, so the subtree
 * is rebuilt from the mount point's current children with any previous copy of
 * itself removed - calling this twice is the same as calling it once. Siblings
 * are preserved, which is what lets this and `withPluginRoutes` compose in
 * either order: each rebuilds only the container it owns.
 */
export const withCoreMainRoutes = <TRouteTree extends AnyRoute>(
  routeTree: TRouteTree,
  {
    localeRouting,
    mountUnder,
    pageHead,
  }: {
    localeRouting: CoreAuthRouteContext["localeRouting"];
    mountUnder: AnyRoute;
    pageHead: CorePageHead;
  },
): TRouteTree => {
  const mounted: AnyRoute[] = mountUnder.children ?? [];
  const siblings = mounted.filter(
    (child: AnyRoute) =>
      (child.options as { id?: string }).id !== CORE_MAIN_ROUTES_ROUTE_ID,
  );

  const container = createRoute({
    getParentRoute: () => mountUnder,
    id: CORE_MAIN_ROUTES_ROUTE_ID,
  });
  const authenticated = authenticatedContainer(container);

  authenticated.addChildren(
    CORE_AUTHENTICATED_ROUTES.map(build =>
      build({ pageHead, parentRoute: authenticated }),
    ),
  );
  container.addChildren([
    ...CORE_PUBLIC_ROUTES.map(build =>
      build({ localeRouting, pageHead, parentRoute: container }),
    ),
    authenticated,
  ]);
  mountUnder.addChildren([...siblings, container]);

  return routeTree;
};
