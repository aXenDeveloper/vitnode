import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import type { SessionApi } from '#/lib/session'

import { socketUserIdFromSession } from '#/lib/realtime'

import { withoutComments } from './source'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * The Stage 8 realtime contract, on the app's side of it:
 *
 *     session (canonical query)  ->  socketUserIdFromSession  ->  WebSocketAuthSync
 *
 * Only this derivation is tested, and it is the only part worth testing here.
 * What follows it is `shouldReconnectForUser` in `@vitnode/core/ws/auth-sync`,
 * which has its own tests, and below that a WebSocket - and a fake socket proves
 * nothing about a real handshake, which is where the identity is actually
 * decided.
 *
 * What can go wrong on this side is the distinction between "signed out" and
 * "not known yet". Both are falsy, both would read as a guest, and collapsing
 * them re-opens the shared connection on every page load for every signed-in
 * visitor - with no error anywhere to say so.
 *
 * `SessionApi` is imported as a type only, so nothing here loads the server
 * function or the fetcher behind it.
 */

/**
 * A session in the shape the API returns, narrowed to what this reads.
 *
 * `as` rather than a full literal: `SessionApi` is inferred from the route's Zod
 * schema and carries fields this function has no opinion about, and writing them
 * out would be a second copy of that schema which typechecks while disagreeing
 * with the server.
 */
const sessionOf = (user: null | { id: number }): SessionApi =>
  ({ user }) as unknown as SessionApi

describe('socketUserIdFromSession', () => {
  it('reports the signed-in visitor', () => {
    expect(socketUserIdFromSession(sessionOf({ id: 42 }))).toBe(42)
  })

  it('reports a guest as null, not as unknown', () => {
    // The API answered. `null` is a fact, and it is what makes a sign-out a
    // transition the socket follows.
    expect(socketUserIdFromSession(sessionOf(null))).toBeNull()
  })

  it('reports an unread session as unknown, not as a guest', () => {
    // No cache entry, or a failed read that `retry: false` left without data.
    // Answering `null` here would be inventing a guest - the mistake
    // `lib/session.ts` refuses - and on a client-side read it is the first
    // value of every page load.
    expect(socketUserIdFromSession(undefined)).toBeUndefined()
  })

  it('keeps the three answers distinguishable', () => {
    // The property the two tests above exist for, stated once: none of the
    // three inputs may collapse into another.
    const answers = [
      socketUserIdFromSession(undefined),
      socketUserIdFromSession(sessionOf(null)),
      socketUserIdFromSession(sessionOf({ id: 1 })),
    ]

    expect(new Set(answers).size).toBe(3)
  })
})

/**
 * Where the realtime listeners are mounted, which is a correctness question
 * rather than a tidiness one.
 *
 * `WebSocketAuthSync` follows a sign-in by seeing the identity *change*: it
 * seeds its ref from its first prop and reconnects only once both sides are
 * known and differ. So it has to already be mounted when the sign-in happens.
 *
 * This app's `/login` is outside `_main`, so the shell is not mounted while a
 * visitor signs in - it mounts for the first time at the destination, by which
 * point `_main`'s loader has already prefetched the *new* session. The sync
 * would seed from `42`, compare it against `42`, and never re-handshake: the
 * socket keeps the guest identity it opened with until a full page load.
 *
 * The Next.js app does not have that problem, because its `/login` is inside
 * `(main)` and the sync stays mounted across the transition. That difference is
 * the whole reason this is asserted here: the shared `ThemeLayoutContent` has a
 * `listeners` slot, filling it is the obvious thing to do, and doing it in this
 * app is silently wrong.
 *
 * A source scan rather than a render: what is being pinned is *which module*
 * mounts them, and mounting a WebSocket in jsdom would prove nothing about a
 * handshake either way.
 */
describe('the realtime listeners are mounted by the root, not by the shell', () => {
  const root = withoutComments(resolve(here, '../routes/__root.tsx'))

  it('mounts them at the root', () => {
    expect(root).toContain(
      "import { RealtimeListeners } from '#/components/realtime-listeners'",
    )
    expect(root).toContain('<RealtimeListeners />')
  })

  it('mounts them inside the WebSocket provider, whose context they read', () => {
    const provider = root.indexOf('<VitNodeWebSocketProvider>')
    const listeners = root.indexOf('<RealtimeListeners />')
    const closed = root.indexOf('</VitNodeWebSocketProvider>')

    expect(provider).toBeGreaterThanOrEqual(0)
    expect(listeners).toBeGreaterThan(provider)
    expect(listeners).toBeLessThan(closed)
  })

  it('does not fill the shell’s `listeners` slot with them', () => {
    // The slot itself stays in `ThemeLayoutContent` for the Next.js app. What
    // must not happen is this app filling it - see above.
    const shell = withoutComments(resolve(here, '../routes/_main.tsx'))

    expect(shell).not.toContain('listeners=')
    expect(shell).not.toContain('WebSocketAuthSync')
    expect(shell).not.toContain('RealtimeListeners')
  })
})
