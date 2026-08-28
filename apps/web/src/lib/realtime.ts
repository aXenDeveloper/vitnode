import type { VitNodeSocketUserId } from '@vitnode/core/ws/auth-sync'

import type { SessionApi } from '#/lib/session'

/**
 * The shell's realtime layer, as the one derivation it needs.
 *
 * Pure by construction - both imports are type-only, so TypeScript erases them
 * and this module has no runtime dependencies at all. That is what lets it be
 * tested without the server function, the fetcher or the WebSocket behind either
 * of them, and it is the same reason `lib/auth/shared.ts` is written this way.
 */

/**
 * The visitor the WebSocket should be authenticated as, from the canonical
 * session.
 *
 * Three inputs and three distinct answers, which is the whole point of the
 * function:
 *
 *     undefined      ->  undefined   the session is not known yet
 *     { user: null } ->  null        the API answered: nobody is signed in
 *     { user }       ->  user.id     the API answered: this visitor
 *
 * `undefined` in means the query has not answered - the entry has not been
 * warmed, or the read failed and `retry: false` left it in an error state with
 * no data. Collapsing that to `null` would be this app inventing a guest, which
 * is the mistake `lib/session.ts` exists to refuse: on a client-side session
 * read it is also the *first* value of every page load, so `WebSocketAuthSync`
 * would read a sign-out and re-open the shared connection each time.
 *
 * `null` out means signed out, and only that. `shouldReconnectForUser` in
 * `@vitnode/core/ws/auth-sync` is the half that acts on the difference.
 */
export const socketUserIdFromSession = (
  session: SessionApi | undefined,
): undefined | VitNodeSocketUserId => {
  if (!session) return undefined

  return session.user?.id ?? null
}
