import type { AnyRouter } from '@tanstack/react-router'

import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { createVitNodeQueryClient } from '@vitnode/core/lib/query-client'
import {
  pluginRouteSpecs,
  withPluginRoutes,
} from '@vitnode/core/tanstack/plugin-routes'

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
import { createLocaleRewrite } from './lib/i18n/runtime'
import { isTanStackOwnedPath } from './migration/navigation'
import { pluginRouteManifest } from './plugin-route-manifest.gen'
import { pluginRouteModules } from './plugin-routes.gen'
import { Route as mainShellRoute } from './routes/_main'
import { routeTree as fileRouteTree } from './routeTree.gen'

/**
 * One route tree: this app's route files, plus the pages its plugins declare.
 *
 * At module scope rather than inside `getRouter`, because `getRouter` runs once
 * per server request and mounting the plugin routes mutates the route tree - the
 * generated tree is a module singleton. `withPluginRoutes` is idempotent anyway;
 * doing it once is simply where it belongs.
 *
 * The plugin half comes from two generated files and is joined by route id. No
 * plugin page is copied into `src/routes`, no route path is written by hand, and
 * nothing here knows which plugins are installed - see
 * `@vitnode/core/tanstack/plugin-routes`.
 *
 * They mount under `_main` rather than under the root, which is the whole of
 * what "a plugin route renders in the application shell" amounts to here: a
 * plugin declares `area: "main"`, `_main` is the route that renders the main
 * shell, and being a child of it is what gives `/example` the header, the
 * breadcrumb area and the one `<main>` that `/discover` has. No new field, no
 * per-route layout metadata, and no second copy of the shell - route
 * composition, which the area declaration already described.
 *
 * `_main` is imported for its route object, and it is the same object the
 * generated tree holds: `createFileRoute` produces one instance per module and
 * `routeTree.gen.ts` mutates it in place.
 */
const routeTree = withPluginRoutes(
  fileRouteTree,
  pluginRouteSpecs(pluginRouteManifest, pluginRouteModules),
  mainShellRoute,
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
 * `rewrite` is what makes one route tree serve two public URL shapes: `/pl/...`
 * arrives, `/...` is matched, and every link the router builds gets the prefix
 * back. No route file mentions a locale, so nothing here has to be duplicated
 * per language - see `lib/i18n/client.ts`.
 */
export function getRouter() {
  const queryClient = createVitNodeQueryClient()

  // The rewrite reads the locale off the router's own current location, and the
  // router needs the rewrite to parse that location - so it is handed a getter
  // rather than the router itself. `output` only ever runs once a link is built,
  // which is long after the assignment below.
  const holder: { current?: AnyRouter } = {}

  const router = createTanStackRouter({
    context: {
      /**
       * The route tree asked about itself, for the code that cannot ask
       * directly.
       *
       * `beforeLoad` receives no router, and the login guard needs the same
       * answer `MigrationLink` gets: is this destination one this app serves, or
       * one the Next.js app still does? Handing the question through the context
       * keeps the route tree as the single source of truth - there is still no
       * list of migrated routes anywhere - and it is one boolean, not a
       * navigation layer.
       *
       * `holder` again, for the same reason `rewrite` uses it: the context is
       * built before the router exists, and this is only ever called from a
       * `beforeLoad`, which is long afterwards.
       */
      ownsPath: (href: string) =>
        holder.current ? isTanStackOwnedPath(holder.current, href) : false,
      queryClient,
    },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
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
