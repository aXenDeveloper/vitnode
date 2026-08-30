import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { withoutComments } from './source'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Where the realtime listeners are mounted, which is a correctness question
 * rather than a tidiness one.
 *
 * The listeners themselves are `@vitnode/core/tanstack/realtime`'s, and so is
 * the derivation they run on - `socketUserIdFromSession`, whose three-way
 * distinction between "signed out", "this visitor" and "not known yet" is tested
 * in that package. What is still this app's to state is the *placement*, because
 * the two applications disagree about where `/login` lives and the wrong answer
 * here fails silently.
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
  /**
   * Stage 10 moved the root provider tree into the package, because every
   * VitNode TanStack app mounts the same one. The rule did not change - the
   * listeners still sit at the root and inside the socket provider - so the scan
   * follows them there, and the app-side half is now "the root mounts that
   * tree".
   */
  const providers = withoutComments(
    resolve(
      here,
      '../../../../packages/vitnode/src/tanstack/layout/root-providers.tsx',
    ),
  )

  it('mounts them at the root', () => {
    // The symbol and the module it comes from, rather than the whole import
    // line: the root legitimately imports more than one thing from that barrel
    // (`NotFound`, for the 404 it renders), and a punctuation change is not a
    // change to where the provider tree lives.
    expect(root).toMatch(
      /import \{[^}]*\bVitNodeRootProviders\b[^}]*\} from '@vitnode\/core\/tanstack\/layout'/,
    )
    expect(root).toContain('<VitNodeRootProviders')
    expect(providers).toContain('<RealtimeListeners />')
  })

  it('mounts them inside the WebSocket provider, whose context they read', () => {
    const provider = providers.indexOf('<VitNodeWebSocketProvider>')
    const listeners = providers.indexOf('<RealtimeListeners />')
    const closed = providers.indexOf('</VitNodeWebSocketProvider>')

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
