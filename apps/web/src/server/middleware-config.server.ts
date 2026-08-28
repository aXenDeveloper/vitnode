import '@tanstack/react-start/server-only'
import type { middlewareModule } from '@vitnode/core/api/modules/middleware/middleware.module'

import { clientModule } from '@vitnode/core/lib/fetcher-client'

import type { MiddlewareConfig } from '#/lib/middleware-config'

import { ANONYMOUS_MIDDLEWARE_CONFIG } from '#/lib/middleware-config'
import { fetcherServer } from '#/server/fetcher.server'

/**
 * The deployment's auth configuration, read during SSR - the TanStack Start
 * counterpart of `@vitnode/core`'s `getMiddlewareApi()`.
 *
 * `fetcherServer` rather than a bare fetch, for the same reason the Discover
 * feed uses it: the API origin comes from the request being rendered, and the
 * visitor's `user-agent` and `x-forwarded-for` go with the call so the rate
 * limiter buckets it correctly. The response itself is the same for everyone.
 *
 * Reached only through the isomorphic transport in `#/lib/middleware-config`,
 * which is what keeps this module - and its `server-only` marker - out of the
 * browser bundle.
 */
const middleware = clientModule<typeof middlewareModule>('@vitnode/core')

export const fetchMiddlewareConfigOnServer =
  async (): Promise<MiddlewareConfig> => {
    try {
      const response = await fetcherServer(middleware, {
        method: 'get',
        module: 'middleware',
        path: '/',
      })

      if (response.status !== 200) return ANONYMOUS_MIDDLEWARE_CONFIG

      return await response.json()
    } catch (error) {
      // `rawApiFetch` throws on a 500 with the failing URL and the server's error
      // text in the message, and an unreachable API throws too. Neither belongs in
      // front of a visitor, and neither should blank the login form: without this
      // configuration the page still renders, minus the provider buttons and the
      // reset-password link.
      // eslint-disable-next-line no-console
      console.error('[auth] middleware configuration unavailable', error)

      return ANONYMOUS_MIDDLEWARE_CONFIG
    }
  }
