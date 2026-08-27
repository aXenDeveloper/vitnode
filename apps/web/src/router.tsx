import type { AnyRouter } from '@tanstack/react-router'

import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { createVitNodeQueryClient } from '@vitnode/core/lib/query-client'

import { createLocaleRewrite } from './lib/i18n/client'
import { routeTree } from './routeTree.gen'

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
    context: { queryClient },
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
