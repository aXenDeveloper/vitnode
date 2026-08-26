import type { usersModule } from '@vitnode/core/api/modules/users/users.module'

import { createServerFn } from '@tanstack/react-start'
import { clientModule } from '@vitnode/core/lib/fetcher-client'

import { fetcherServer } from '#/server/fetcher.server'

/**
 * The users module by type only, so nothing the API needs at runtime - Hono,
 * Drizzle, the plugin tree - is reachable from a module the router imports.
 * `clientModule` keeps the route paths, methods and response schemas fully
 * typed while carrying just the `pluginId` the fetcher reads.
 */
const users = clientModule<typeof usersModule>('@vitnode/core')

export type SessionApi = Awaited<ReturnType<typeof getSession>>

/**
 * The signed-in visitor, or `{ user: null }` - the TanStack Start counterpart of
 * `@vitnode/core`'s `getSessionApi()`.
 *
 * A `createServerFn` rather than a route `loader`, because a loader also runs in
 * the browser on client-side navigation and there is no request to read there.
 * As a server function it runs on the server both times: directly during SSR,
 * and over same-origin RPC afterwards - which carries the visitor's cookies to
 * this server, where `fetcherServer` forwards them on.
 *
 * Deliberately not cached, for the same reason `getSessionApi()` is not: the
 * response is per-visitor and changes the moment they sign in or edit their
 * profile, so there is no shared entry to hand out. The database work behind it
 * is cached in Redis by the API instead.
 *
 * One call per navigation as long as callers read it through the route's loader
 * data. Core wraps its version in React's `cache()` because a Next layout,
 * header and page each ask for the session while rendering one page; if the same
 * shape appears here, that per-render memoisation has to come with it.
 */
export const getSession = createServerFn().handler(async () => {
  const response = await fetcherServer(users, {
    method: 'get',
    module: 'users',
    path: '/session',
  })

  // A non-200 (a 429 from the rate limiter, say) carries something other than a
  // session, so read it as "nobody is signed in" rather than crashing the render
  // while parsing it. One shape either way, so callers never have to narrow.
  if (response.status !== 200) {
    return { ai: { models: [] }, user: null }
  }

  return await response.json()
})
