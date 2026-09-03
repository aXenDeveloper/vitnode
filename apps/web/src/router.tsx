import type { AnyRouter } from '@tanstack/react-router'

import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { createVitNodeQueryClient } from '@vitnode/core/lib/query-client'
import { RoutePendingSpinner } from '@vitnode/core/tanstack/pending'
import {
  pluginRouteSpecs,
  withPluginRoutes,
} from '@vitnode/core/tanstack/plugin-routes'
import {
  withCoreAdminRoutes,
  withCoreMainRoutes,
  withCoreRootRoutes,
} from '@vitnode/core/tanstack/routes'

/**
 * The auth transport, registered by importing the module that declares it.
 *
 * `@vitnode/core/tanstack/auth` owns every auth decision this app makes but may
 * not declare a `createServerFn` - uncompiled on the server, one silently
 * resolves to `undefined` - so `lib/auth.ts` declares the eight wrappers and
 * hands them over at module scope. A bare import because there is nothing to
 * name: the registration *is* the module's effect.
 *
 * Here because a router is the one module both entry points load, so the
 * registration has happened before any route, loader or component can reach for
 * it, in the browser bundle and on the server alike.
 */
import './lib/auth'
/**
 * The admin transport, registered the same way and for the same reason.
 *
 * One server function rather than eight, reading the AdminCP's own session under
 * its own cookie. It is a separate registration from the auth one on purpose:
 * they are two sessions, two cookies and two cache entries, and nothing in
 * VitNode may let the public session answer an admin question.
 */
import './lib/admin-auth'
import { createLocaleRewrite, localeRouting } from './lib/i18n/runtime'
import { pageHead } from './lib/page-head'
import { pluginRouteSources } from './plugin-routes.gen'
import { Route as adminShellRoute } from './routes/_admin'
import { Route as mainShellRoute } from './routes/_main'
import { routeTree as fileRouteTree } from './routeTree.gen'

/**
 * The Content Engine registry, behind a literal dynamic import.
 *
 * Awaited by the one loader that needs it - `/admin/content/*` - rather than
 * imported here. Building the registry reaches `@vitnode/core/content` and
 * every configured plugin's admin form components, and this module is the one
 * the client entry evaluates on every page: as a static import it put `zod`,
 * both plugins' content registrations, the content form primitives and
 * `react-hook-form` in front of the homepage's first paint. See
 * `CoreAdminRouteContext.loadContentRegistry`.
 */
const loadContentRegistry = async () =>
  (await import('#/lib/content-registry')).contentRegistry

/**
 * One route tree: this app's route files, plus the AdminCP screens `@vitnode/core`
 * owns, plus the pages its plugins declare.
 *
 * At module scope rather than inside `getRouter`, because `getRouter` runs once
 * per server request and mounting the plugin routes mutates the route tree - the
 * generated tree is a module singleton. `withPluginRoutes` is idempotent anyway;
 * doing it once is simply where it belongs.
 *
 * The plugin half comes from one generated file: a static import of each
 * configured plugin's own route tree. No plugin page is copied into
 * `src/routes`, no route path is written by hand, and nothing here knows which
 * plugins are installed - see `@vitnode/core/tanstack/plugin-routes`.
 *
 * A page is reached only through the literal `lazy(() => import(...))` its route
 * declared, so every one of them is a chunk of its own. The one part of a plugin
 * route that is not lazy is a `search` schema: a router's `validateSearch` runs
 * during path matching, before any chunk is fetched, so it lives in the tree
 * rather than in the page.
 *
 * `mountUnder` names one route per shell, which is the whole of what "a plugin
 * route renders in the application shell" amounts to here. A plugin declares
 * `area: "main"` or `area: "admin"`; `_main` is the route that renders the
 * public shell and `_admin` the one that renders the AdminCP, and being a child
 * of one of them is what gives `/example` the header and the one `<main>` that
 * `/discover` has, or gives `/admin/reports` the sidebar, the breadcrumb area
 * and the admin session guard that `/admin/core` has. No new field, no per-route
 * layout metadata and no second copy of either shell - route composition, which
 * the area declaration already described.
 *
 * Neither shell changes a path: both are pathless, so `/example` stays
 * `/example` and an admin plugin route's `/admin/…` is the path its own route
 * spells out in full. An area VitNode knows and this app has not named here
 * fails the composition rather than being mounted under the other one.
 *
 * `_main` and `_admin` are imported for their route objects, and they are the
 * same objects the generated tree holds: `createFileRoute` produces one instance
 * per module and `routeTree.gen.ts` mutates it in place.
 *
 * `withCoreMainRoutes`, `withCoreAdminRoutes` and `withCoreRootRoutes` mount
 * core's own screens the same way, one per mount point: the public pages under
 * the main shell, the AdminCP's under its own, and the shell-less ones - the auth
 * cards and the AdminCP sign-in - straight under the root. See
 * `@vitnode/core/tanstack/routes`.
 *
 * `localeRouting` is handed to the last of the three because a sign-in navigates
 * to a path a *visitor* supplied: the route tree carries no locale, so the prefix
 * has to be stripped before the router sees it, and which prefixes exist is this
 * app's answer. It is the same object the `rewrite` below uses, so the strip and
 * the write-back are one rule. They were a directory of route files in this application until it
 * existed - one `createFileRoute` per screen, every one of them pure wiring
 * around something imported from `@vitnode/core` - so an app carried a copy of
 * VitNode's own routing table and core adding a screen meant an edit here. They
 * are code-based rather than declared as plugin routes because they need the
 * router's full option set: a real `validateSearch` that clamps `?page=999`
 * before anything renders, and a splat path a plugin route path does not
 * represent.
 *
 * `pageHead` is this app's own `createRouteHead(metadata)` binding, handed over
 * because a package cannot know the site's name: a plugin page's `<title>` goes
 * through the same `"<page> - <site>"` rule every other VitNode page's does,
 * rather than through a second one the plugin invented.
 */
const routeTree = withCoreRootRoutes(
  withCoreAdminRoutes(
    withCoreMainRoutes(
      withPluginRoutes(fileRouteTree, pluginRouteSpecs(pluginRouteSources), {
        mountUnder: { admin: adminShellRoute, main: mainShellRoute },
        pageHead,
      }),
      { mountUnder: mainShellRoute, pageHead },
    ),
    { loadContentRegistry, mountUnder: adminShellRoute, pageHead },
  ),
  { localeRouting, mountUnder: fileRouteTree, pageHead },
)

/**
 * The app's router, and the QueryClient it owns.
 *
 * Start calls this once per server request and once in the browser, which is
 * exactly the lifetime a QueryClient should have: created here, it is per
 * request on the server - never a module-level client shared by every visitor
 * being rendered at once - and a single long-lived one on the client.
 *
 * It goes into the router context, so a route loader reaches it as
 * `context.queryClient` and can `ensureQueryData` before its component renders.
 * That is the whole point of putting it here rather than in a provider: a
 * loader runs before React does, so a client mounted by a component would be
 * out of reach of the code that most wants it.
 *
 * `setupRouterSsrQueryIntegration` wires the two together: it dehydrates the
 * cache into the SSR stream (including queries that resolve mid-render),
 * hydrates it on the client before the first render, routes `redirect()` thrown
 * inside a query or mutation through the router, and wraps the app in the one
 * `QueryClientProvider` for this client. Nothing else in this app may create a
 * `QueryClient` or a provider for one - two clients in a page means a query a
 * loader cached is invisible to the component that reads it.
 *
 * `defaultPreloadStaleTime: 0` leaves caching to Query rather than having the
 * router keep a second copy of the same data with its own expiry.
 *
 * `defaultStaleReloadMode: 'blocking'` is what makes a route's pending shape
 * reachable at all once preloading is on. Router core's default is
 * `'background'`, and a background reload never opens a pending window - but it
 * still waits for the route's component chunk before it commits. So the common
 * desktop path, hover a link and click it, took the one branch that renders
 * nothing: the hover filled the loader, the click was therefore a background
 * reload, and the chunk downloaded with the previous page still on screen and
 * no skeleton in sight.
 *
 * It costs nothing here because a VitNode loader does not block on a warm cache:
 * `ensureQueryData` with `revalidateIfStale` hands back the cached entry and
 * refreshes behind it, so "blocking" describes a promise that resolves in a
 * microtask. What changes is only that the router now marks the match pending
 * while that happens, which is what `defaultPendingMs` is for.
 *
 * `defaultPendingMs: 150` is that threshold, and it is not zero for the same
 * reason. At zero, every navigation opens a pending window, so
 * `defaultPendingMinMs` holds a *fully cached* navigation behind a skeleton for
 * 300ms - a page that could have been instant, made slow to look busy. At 150ms
 * a cached navigation goes straight through with nothing shown and a slow one
 * still gets its shape, in the content area and the breadcrumb together.
 *
 * `rewrite` is what makes one route tree serve two public URL shapes: `/pl/...`
 * arrives, `/...` is matched, and every link the router builds gets the prefix
 * back. No route file mentions a locale, so nothing here has to be duplicated
 * per language - see `@vitnode/core/tanstack/i18n`.
 */
export function getRouter() {
  const queryClient = createVitNodeQueryClient()

  // The rewrite reads the locale off the router's own current location, and the
  // router needs the rewrite to parse that location - so it is handed a getter
  // rather than the router itself. `output` only ever runs once a link is built,
  // which is long after the assignment below.
  const holder: { current?: AnyRouter } = {}

  const router = createTanStackRouter({
    context: { queryClient },
    defaultPendingComponent: RoutePendingSpinner,
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultStaleReloadMode: 'blocking',
    rewrite: createLocaleRewrite(() => holder.current),
    routeTree,
    scrollRestoration: true,
  })

  holder.current = router

  setupRouterSsrQueryIntegration({ queryClient, router })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
