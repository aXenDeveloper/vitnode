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

import './lib/auth'
import './lib/admin-auth'
import { createLocaleRewrite, localeRouting } from './lib/i18n/runtime'
import { pageHead } from './lib/page-head'
import { pluginRouteSources } from './plugin-routes.gen'
import { Route as adminShellRoute } from './routes/_admin'
import { Route as mainShellRoute } from './routes/_main'
import { routeTree as fileRouteTree } from './routeTree.gen'

const loadContentRegistry = async () =>
  (await import('#/lib/content-registry')).contentRegistry

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

export function getRouter() {
  const queryClient = createVitNodeQueryClient()
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
