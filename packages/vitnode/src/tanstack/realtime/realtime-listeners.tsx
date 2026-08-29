"use client";

import { useQuery } from "@tanstack/react-query";

import { NotificationListener } from "@/views/layouts/theme/notification-listener";
import { WebSocketAuthSync } from "@/views/layouts/theme/web-socket-auth-sync";

import { sessionQueryOptions } from "../auth/session-query";
import { socketUserIdFromSession } from "./session";

/**
 * The two behaviors that belong to the WebSocket connection: the notification
 * toasts, and keeping the socket authenticated as whoever is signed in.
 *
 *     __root       VitNodeWebSocketProvider   one connection, one lifetime
 *       __root     RealtimeListeners          the listener, and the identity
 *
 * Both components below are shared with the Next.js applications, which mount
 * the same pair from `ThemeLayout`. Neither renders anything; this exists to
 * give them the one thing they cannot get for themselves in a router-driven app
 * - the visitor's id - and to keep that read in a single place rather than in
 * each of them.
 *
 * ## Mount it at the root, not in the shell's `listeners` slot
 *
 * The slot reads as the tidier answer: `ThemeLayoutContent` has one named
 * `listeners` and the Next.js app fills it. It is the wrong place in a TanStack
 * Start app whose `/login` sits *outside* the main shell - which is the usual
 * arrangement, because an auth screen is a full-height card with no header.
 *
 * `WebSocketAuthSync` follows a sign-in by seeing the identity change: it seeds
 * its ref from its first prop and reconnects only once both sides are known and
 * differ. Mounted in a shell the visitor is not inside while they sign in, it
 * first mounts at the destination - by which point the session query already
 * answers `42`, `shouldReconnectForUser(42, 42)` is `false`, and the socket
 * keeps the guest handshake it opened with until the next full page load. The
 * visitor is signed in everywhere except the connection that delivers their
 * notifications.
 *
 * The sharp edge is that it half-works without the shell's loader - a stale
 * guest session is observed first, so the identity still moves `null -> 42` -
 * and breaks the moment the shell prefetches the session for the header's sake.
 * Which is to say: it would be introduced by a one-line performance fix, in a
 * component neither line mentions.
 *
 * So the rule is the one the provider already follows: anything whose lifetime
 * is *the connection's* is mounted where the connection is. The slot stays in
 * `ThemeLayoutContent` for the framework that has somewhere to put it.
 *
 * ## Where the id comes from
 *
 * {@link sessionQueryOptions} - the one session definition a VitNode TanStack
 * app has, the same one its route guards and its header read. So this makes no
 * second request and adds no second key: a guarded route warms that entry in its
 * guard, the shell warms it in its loader, and this is a read of whichever one
 * got there first.
 *
 * `useQuery` rather than `useSuspenseQuery`, for two reasons. It must not
 * suspend - it sits above every route, and suspending here would hold back the
 * whole document for a value only an invisible effect wants. And it must not
 * throw: the session read is `retry: false`, so an API outage records a failure
 * in that entry, and a suspense read would rethrow it into the nearest boundary
 * and take the entire application down with it. Read this way a failure arrives
 * as `undefined`, which {@link socketUserIdFromSession} reports as "not known
 * yet" and `WebSocketAuthSync` correctly does nothing about - the socket keeps
 * whatever identity its handshake gave it.
 *
 * On a route that warms nothing - an SSO callback - the observer mounted here is
 * what fetches the session at all, and that is desirable rather than a cost:
 * completing the sign-in invalidates that entry, this refetches it, the identity
 * moves, and the socket re-handshakes. During SSR it renders with `undefined`
 * and does nothing, which is correct: effects do not run there and there is no
 * socket yet.
 *
 * ## What it does on sign-in and sign-out
 *
 * Nothing directly - it has no handlers. An auth action brings that one cache
 * entry back in step with the cookie before it navigates, this re-renders from
 * it, and the identity change is what re-opens the socket so the server re-reads
 * the cookie on a fresh handshake. Which is what stops the previous visitor's
 * notifications from reaching this browser, with no page reload.
 *
 * ## No route guard depends on this being mounted
 *
 * Worth stating because for a while one silently did. The observer below is an
 * *active* one, and `invalidateQueries` refetches active queries - so while a
 * guard read the session through `ensureQueryData`, which ignores invalidation
 * entirely, the refetch performed for **this** component was the only thing
 * making a post-sign-in navigation see the new visitor. Moving this into a
 * shell's `listeners` slot, or gating it, would have turned every sign-in into a
 * bounce back to the login page, in a file neither change mentions.
 *
 * `ensureAuthState` reads through `fetchQuery` now, which consults the mark
 * itself, so the guards are correct with nothing observing the entry at all.
 * What this component is still responsible for is its own job: the socket's
 * identity. Move it freely on those grounds.
 */
export const RealtimeListeners = () => {
  const { data: session } = useQuery(sessionQueryOptions());

  return (
    <>
      <NotificationListener />
      <WebSocketAuthSync userId={socketUserIdFromSession(session)} />
    </>
  );
};
