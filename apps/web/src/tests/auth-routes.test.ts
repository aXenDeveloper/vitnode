import { postAuthDestination } from '@vitnode/core/tanstack/auth'
import { describe, expect, it } from 'vitest'

import { getRouter } from '#/router'

/**
 * Where the two migrated auth routes sit in this application's route tree.
 *
 * Questions put to the route tree, and nothing else: the decisions those routes
 * make - which recovery screen a URL asks for, whether this deployment has the
 * flow at all - are pure functions in `@vitnode/core/tanstack/auth`, and are
 * asserted beside their implementation in `tanstack/auth/recovery.test.ts`.
 * What cannot move is the shape of the tree, because that is this app's.
 */

describe('where registration sends a visitor who is already signed in', () => {
  it('is the front page, through the same rule the login guard uses', () => {
    // `/register` takes no `returnTo` - nothing links to it with one - so the
    // guard's destination is whatever a finished sign-in lands on by default.
    expect(postAuthDestination(undefined)).toBe('/')
  })
})

describe('where the two migrated auth routes sit in the tree', () => {
  const routeIdsFor = (pathname: string): string[] =>
    getRouter()
      .matchRoutes(pathname, undefined)
      .map((match) => match.routeId)

  /**
   * Neither page is under the application shell.
   *
   * Stage 8 keeps `/login` and the SSO callback outside `_main`, and these two
   * join them: they are full-height blank auth screens, and mounting the site
   * header above a signup card would be a product change. Asserted as route
   * *structure*, which is what decides it.
   */
  it.each(['/register', '/login/reset-password'])(
    '%s renders outside the main shell',
    (pathname) => {
      expect(routeIdsFor(pathname)).not.toContain('/_main')
    },
  )

  /**
   * Password recovery must not inherit the login page's guest-only guard.
   *
   * A recovery link is followed out of an email, on whatever device is to hand,
   * and a visitor already signed in elsewhere has every right to finish setting a
   * new password - the Next.js view has never checked a session. Nested under
   * `/login`, the guest guard would redirect them away mid-flow and burn a
   * one-shot token. Registration, by contrast, *is* guest-only, exactly as
   * `/login` is.
   */
  it('does not put password recovery under the login route', () => {
    expect(routeIdsFor('/login/reset-password')).not.toContain('/login')
  })

  /**
   * `/login` stays an exact match, so ownership is decided at each leaf.
   *
   * `matchRoutes` answers with the deepest *ancestor* it can match and leaves the
   * rest unconsumed - which is why a `/login` with children would claim every
   * legacy URL beneath it. Both migrated routes are non-nested siblings, so
   * `/login` consumes exactly `/login` and an unmigrated path below it still
   * resolves to the parent rather than to a leaf.
   */
  it('keeps /login consuming only its own path', () => {
    const deepest = (pathname: string) =>
      getRouter().matchRoutes(pathname, undefined).at(-1) as {
        pathname: string
        routeId: string
      }

    expect(deepest('/login')).toMatchObject({
      pathname: '/login',
      routeId: '/_core-root/login',
    })
    expect(deepest('/login/reset-password')).toMatchObject({
      pathname: '/login/reset-password',
      routeId: '/_core-root/login/reset-password',
    })
    // Still nobody's: matched at `/login`, having consumed less than was asked.
    expect(deepest('/login/something-else')).toMatchObject({
      pathname: '/login',
      routeId: '/_core-root/login',
    })
  })
})
