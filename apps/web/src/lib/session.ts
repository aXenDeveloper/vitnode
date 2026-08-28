import type { usersModule } from '@vitnode/core/api/modules/users/users.module'

import { createServerFn } from '@tanstack/react-start'
import { clientModule } from '@vitnode/core/lib/fetcher-client'

import { isUsableSessionStatus } from '#/lib/auth/contract'
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
 * What the browser is told when the session could not be read.
 *
 * A fixed sentence and nothing else. An error thrown out of a server function
 * is serialized back to the caller, and the errors this one catches are not fit
 * to send: `rawApiFetch` throws on a 500 with the failing API URL and the
 * server's own error text in the message. The detail is logged where a server
 * log is the right place for it.
 */
export const SESSION_UNAVAILABLE = 'The session could not be read.'

/**
 * The signed-in visitor, or `{ user: null }` - the TanStack Start counterpart of
 * `@vitnode/core`'s `getSessionApi()`.
 *
 * ## It rejects rather than inventing a guest
 *
 * `{ user: null }` means one thing only: the API answered, and nobody is signed
 * in. A read that could not be *evaluated* - a 429 from the rate limiter, a 500,
 * an API that is not listening - is an error, not an anonymous visitor.
 *
 * This used to return `{ ai: { models: [] }, user: null }` for every non-200,
 * which signed people out during an outage: the guard on a protected route read
 * the fabricated `user: null`, believed it, and redirected a signed-in visitor
 * to the login page. Rejecting instead leaves the query in an error state, which
 * is what TanStack Query is for, and the route's normal error path handles it.
 *
 * `rawApiFetch` already throws on a 500, so that case arrives here as an
 * exception and is handled identically - one failure mode, not two.
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
  try {
    const response = await fetcherServer(users, {
      method: 'get',
      module: 'users',
      path: '/session',
    })

    if (isUsableSessionStatus(response.status)) return await response.json()

    // Caught immediately below. Thrown rather than returned so there is one
    // failure path and one log line, and so the status reaches the log.
    throw new Error(`the session route answered ${response.status}`)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[auth] ${SESSION_UNAVAILABLE}`, error)

    // No `cause`: this error is serialized back to the browser, and the one it
    // would carry is `rawApiFetch`'s - the failing API URL and the server's own
    // error text. It has just been written to the server log, which is where it
    // belongs; attaching it here would publish it. This is the whole reason the
    // message is a fixed sentence.
    // eslint-disable-next-line preserve-caught-error
    throw new Error(SESSION_UNAVAILABLE)
  }
})
