/**
 * Whether a change of signed-in user requires the shared WebSocket to be
 * re-opened - the one decision behind `WebSocketAuthSync`, as a pure function.
 *
 * It lives here, next to the manager it ultimately drives, rather than inside
 * the component: the rule is about the socket's handshake, it is identical in
 * every framework that mounts the component, and it is the part that can be
 * wrong without anything failing loudly.
 */

/**
 * The user a WebSocket connection is authenticated as, as far as the client
 * knows.
 *
 * `number` is a signed-in visitor, `null` a guest - the server derives the same
 * value from the session cookie on the upgrade request (`handleVitNodeWebSocket`
 * tags each connection with `c.get("user")?.id ?? null`) so it can deliver a
 * per-user payload to the right connections.
 */
export type VitNodeSocketUserId = null | number;

/**
 * Whether the socket has to be dropped and re-opened, given the last identity
 * it was known to carry and the one it should carry now.
 *
 * The connection authenticates once, during its HTTP upgrade, from the cookies
 * the browser sent with it. Nothing afterwards can change who the server thinks
 * it belongs to - so the only way to follow a sign-in or a sign-out is a fresh
 * handshake, and {@link WebSocketManager.reconnect} is what performs one.
 *
 * ## `undefined` is "not known yet", and it must not reconnect
 *
 * A framework that resolves the session on the server before rendering - Next.js
 * with `getSessionApi()` - always passes a known value, so this case never
 * arises there. A client-side session read does: the component's first render
 * happens before the query has answered, and the identity arrives one render
 * later.
 *
 * Both directions of that are handled here, and both matter:
 *
 * - `next === undefined` - the session has become unknown again (a cleared cache
 *   entry). Nothing is learned, so nothing is done, and the caller keeps the
 *   last identity it *did* know rather than forgetting it.
 * - `previous === undefined` - the first identity this client has learned. The
 *   socket already opened with the visitor's cookies attached, so the server has
 *   had the right user all along and there is nothing to correct. Reconnecting
 *   here would tear down the shared connection - and, because the manager
 *   relays a reconnect to the leader tab, every tab's connection with it - on
 *   every single page load.
 *
 * Once both sides are known it is a plain inequality: guest to user, user to
 * guest, and one user to another are each a new handshake; the same id answered
 * twice is not.
 */
export const shouldReconnectForUser = (
  previous: undefined | VitNodeSocketUserId,
  next: undefined | VitNodeSocketUserId,
): boolean => {
  if (next === undefined || previous === undefined) return false;

  return previous !== next;
};
