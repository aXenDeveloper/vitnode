import type { VitNodeSocketUserId } from "@/ws/auth-sync";

/**
 * The realtime layer's one derivation, and the type it reads.
 *
 * Pure by construction - the only import is type-only, so TypeScript erases it
 * and this module has no runtime dependencies at all. That is what lets it be
 * tested without a session query, a fetcher or the WebSocket behind either of
 * them.
 */

/**
 * A session, narrowed to the one field the socket's identity comes from.
 *
 * A *requirement* rather than a copy of the API's response, the same way
 * `UserHeaderUser` is: every application's session type satisfies it
 * structurally, so nobody reshapes anything, and a field renamed in
 * `api/modules/users/routes/session.route.ts` fails here rather than being
 * silently read as `undefined`.
 */
export interface SocketSession {
  user?: null | { id: number };
}

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
 * no data. Collapsing that to `null` would be the client inventing a guest,
 * which is what a session read must refuse: on a client-side read it is also the
 * *first* value of every page load, so `WebSocketAuthSync` would see a sign-out
 * and re-open the shared connection each time.
 *
 * `null` out means signed out, and only that. `shouldReconnectForUser` in
 * `@/ws/auth-sync` is the half that acts on the difference.
 */
export const socketUserIdFromSession = (
  session: SocketSession | undefined,
): undefined | VitNodeSocketUserId => {
  if (!session) return undefined;

  return session.user?.id ?? null;
};
