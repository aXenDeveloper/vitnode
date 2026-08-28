import { useQuery } from '@tanstack/react-query'
import { NotificationListener } from '@vitnode/core/views/layouts/theme/notification-listener'
import { WebSocketAuthSync } from '@vitnode/core/views/layouts/theme/web-socket-auth-sync'

import { sessionQueryOptions } from '#/lib/auth/query'
import { socketUserIdFromSession } from '#/lib/realtime'

/**
 * The two behaviors that belong to the WebSocket connection: the notification
 * toasts, and keeping the socket authenticated as whoever is signed in.
 *
 *     __root       VitNodeWebSocketProvider   one connection, one lifetime
 *       __root     RealtimeListeners          the listener, and the identity
 *
 * Both components are `@vitnode/core`'s own, shared verbatim with the Next.js
 * app, which mounts the same pair from `ThemeLayout`. Neither renders anything;
 * this exists to give them the one thing they cannot get for themselves here -
 * the visitor's id - and to keep that read in a single place rather than in each
 * of them.
 *
 * ## Why this is at the root and not in the shell's `listeners` slot
 *
 * It was in the slot, which reads as the tidier answer: `ThemeLayoutContent` has
 * a slot named `listeners`, the Next.js app fills it, so `_main` should fill it
 * too. That is wrong here, and the reason is that the two applications disagree
 * about where `/login` lives.
 *
 * In Next.js `/login` is inside `(main)`, so `WebSocketAuthSync` is mounted
 * while a visitor signs in and stays mounted through the transition afterwards:
 * it holds `previous = null`, sees `next = 42`, and reconnects. In this app
 * `/login` is deliberately outside `_main` - an auth screen is a full-height
 * card with no header - so the shell is *not* mounted while they sign in. It
 * mounts for the first time at the destination, by which point the session query
 * already answers `42`. `WebSocketAuthSync` seeds its ref from its first prop,
 * `shouldReconnectForUser(42, 42)` is `false`, and the socket keeps the guest
 * handshake it opened with until the next full page load. The visitor is signed
 * in everywhere except the connection that delivers their notifications.
 *
 * The sharp edge is that it half-works without the shell's loader - the stale
 * guest session is observed first, so the identity still moves `null -> 42` -
 * and breaks the moment `prefetchSession` is added to `_main` for the header's
 * sake. Which is to say: it would have been introduced by a one-line performance
 * fix, in a component neither line mentions.
 *
 * So the rule this file follows is the one the provider already follows.
 * Anything whose lifetime is *the connection's* is mounted where the connection
 * is; anything whose lifetime is the visual shell's goes in the shell. The
 * socket's identity is plainly the former - it must survive every navigation
 * that the connection survives, including the navigation away from an auth
 * screen. `ThemeLayoutContent`'s `listeners` slot stays exactly as it is, for
 * the Next.js app that has somewhere to put it.
 *
 * It also restores parity in passing: `NotificationListener` is mounted on the
 * login screen in the Next.js app, and mounting it here is what keeps that true.
 *
 * ## Where the id comes from
 *
 * `sessionQueryOptions()` - the one session definition in this app, the same one
 * `_authenticated`'s guard and the header read. So this makes no second request
 * and adds no second key: `/login` warms that entry in its guard, `_main` warms
 * it in its loader, and this is a read of whichever one got there first. See
 * `lib/auth/query.ts`, which explains why there is exactly one.
 *
 * `useQuery` rather than `useSuspenseQuery`, for two reasons. It must not
 * suspend - it sits above every route, and suspending here would hold back the
 * whole document for a value only an invisible effect wants. And it must not
 * throw: the session read is `retry: false`, so an API outage records a failure
 * in that entry, and a suspense read would rethrow it into the nearest boundary
 * and take the entire application down with it. Read this way a failure arrives
 * as `undefined`, which `socketUserIdFromSession` reports as "not known yet" and
 * `WebSocketAuthSync` correctly does nothing about - the socket keeps whatever
 * identity its handshake gave it.
 *
 * On a route that warms nothing - the SSO callback - the observer mounted here
 * is what fetches the session at all, and that is the desired behaviour rather
 * than a cost: completing an SSO sign-in invalidates that entry, this refetches
 * it, the identity moves, and the socket re-handshakes. During SSR it renders
 * with `undefined` and does nothing, which is correct: effects do not run there
 * and there is no socket yet.
 *
 * ## What it does on sign-in and sign-out
 *
 * Nothing directly - it has no handlers. `lib/auth/actions.ts` brings that one
 * cache entry back in step with the cookie before it navigates, this re-renders
 * from it, and the identity change is what re-opens the socket so the server
 * re-reads the cookie on a fresh handshake. Which is what stops the previous
 * visitor's notifications from reaching this browser, with no page reload.
 *
 * ## No route guard depends on this being mounted
 *
 * Worth stating because for a while one silently did. The observer below is an
 * *active* one, and `invalidateQueries` refetches active queries - so while a
 * guard read the session through `ensureQueryData`, which ignores invalidation
 * entirely, the refetch performed for **this** component was the only thing
 * making a post-sign-in navigation see the new visitor. Moving this into the
 * shell's `listeners` slot, or gating it, would have turned every sign-in into a
 * bounce back to the login page, in a file neither change mentions.
 *
 * `ensureAuthState` reads through `fetchQuery` now, which consults the mark
 * itself, so the guards are correct with nothing observing the entry at all.
 * What this component is still responsible for is its own job: the socket's
 * identity. Move it freely on those grounds.
 */
export const RealtimeListeners = () => {
  const { data: session } = useQuery(sessionQueryOptions())

  return (
    <>
      <NotificationListener />
      <WebSocketAuthSync userId={socketUserIdFromSession(session)} />
    </>
  )
}
