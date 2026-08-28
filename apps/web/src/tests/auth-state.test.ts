import { describe, expect, it } from 'vitest'

import type { AuthUser } from '#/lib/auth/shared'
import type { SessionApi } from '#/lib/session'

import { i18n } from '#/i18n'
import {
  authStateFromSession,
  canAccessAdminRoute,
  canAccessAuthenticatedRoute,
  canAccessGuestRoute,
  SESSION_QUERY_KEY,
} from '#/lib/auth/shared'

/**
 * The Stage 6 auth contract:
 *
 *     session (API)  ->  authStateFromSession  ->  route context  ->  guards
 *
 * Only the pure half is exercised here, which is also the only half worth
 * testing: the transport is one `createServerFn` around a `GET`, and the
 * authorization that actually matters lives in Hono, on the server, behind the
 * session cookie. What can silently go wrong on this side is the *derivation* -
 * a guest read as signed in, an unimplemented role read as a permission, a query
 * key that quietly varies per language - and all three are decided by the
 * functions below.
 *
 * `SessionApi` is imported as a type only, so nothing here loads the server
 * function or the fetcher it reaches for.
 */

const anonymousSession: SessionApi = { ai: { models: [] }, user: null }

/** A signed-in visitor, exactly as `users/session.route.ts` describes one. */
const userFixture = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  avatarColor: '#101010',
  birthday: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  email: 'test@test.com',
  emailVerified: true,
  id: 1,
  isAdmin: false,
  isModerator: false,
  name: 'Test',
  nameCode: 'test',
  newsletter: false,
  roleId: 1,
  ...overrides,
})

const sessionFor = (user: AuthUser): SessionApi => ({
  ai: { models: [] },
  user,
})

describe('a session becomes an auth state', () => {
  it('reads a null user as a guest', () => {
    const auth = authStateFromSession(anonymousSession)

    expect(auth.isAuthenticated).toBe(false)
    expect(auth.isAdmin).toBe(false)
    expect(auth.user).toBeNull()
  })

  it('reads a user as authenticated, without copying them', () => {
    const user = userFixture()
    const session = sessionFor(user)
    const auth = authStateFromSession(session)

    expect(auth.isAuthenticated).toBe(true)
    // The same objects, not clones: a page reads the visitor and `ai.models`
    // off this state, and a copy is a second answer that can drift.
    expect(auth.user).toBe(user)
    expect(auth.session).toBe(session)
  })

  it('reads an admin as an admin', () => {
    const auth = authStateFromSession(
      sessionFor(userFixture({ isAdmin: true })),
    )

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.isAdmin).toBe(true)
  })

  /**
   * The API answers `isModerator: false` unconditionally - it is a `TODO`, not a
   * role. So the auth state must not carry a moderator flag at all: one would
   * read as authorization while being a constant, and would start granting
   * access on its own the day the API begins computing it.
   */
  it('does not promote a moderator to anything', () => {
    const auth = authStateFromSession(
      sessionFor(userFixture({ isModerator: true })),
    )

    expect(auth.isAdmin).toBe(false)
    expect('isModerator' in auth).toBe(false)
  })

  /**
   * `beforeLoad` also runs on preload, on hover, and again on the navigation
   * itself. The derivation therefore has to be a function of its argument and
   * nothing else - no clock, no counter, no cache of its own.
   */
  it('answers the same session identically every time', () => {
    const session = sessionFor(userFixture({ isAdmin: true }))

    expect(authStateFromSession(session)).toEqual(authStateFromSession(session))
    expect(authStateFromSession(anonymousSession)).toEqual(
      authStateFromSession(anonymousSession),
    )
  })
})

describe('the access predicates', () => {
  const guest = authStateFromSession(anonymousSession)
  const member = authStateFromSession(sessionFor(userFixture()))
  const admin = authStateFromSession(sessionFor(userFixture({ isAdmin: true })))

  it('lets only a guest into a guest-only route', () => {
    expect(canAccessGuestRoute(guest)).toBe(true)
    expect(canAccessGuestRoute(member)).toBe(false)
    expect(canAccessGuestRoute(admin)).toBe(false)
  })

  it('lets only a signed-in visitor into an authenticated route', () => {
    expect(canAccessAuthenticatedRoute(guest)).toBe(false)
    expect(canAccessAuthenticatedRoute(member)).toBe(true)
    expect(canAccessAuthenticatedRoute(admin)).toBe(true)
  })

  it('lets only an admin into an admin route', () => {
    expect(canAccessAdminRoute(guest)).toBe(false)
    expect(canAccessAdminRoute(member)).toBe(false)
    expect(canAccessAdminRoute(admin)).toBe(true)
  })

  it('never opens both a guest route and an authenticated one', () => {
    for (const auth of [guest, member, admin]) {
      expect(canAccessGuestRoute(auth)).toBe(!canAccessAuthenticatedRoute(auth))
    }
  })
})

describe('the session cache key', () => {
  it('is one stable entry', () => {
    expect(SESSION_QUERY_KEY).toEqual(['vitnode', 'session'])
  })

  /**
   * The session is *who* the visitor is, which does not change because they read
   * the page in Polish. A locale in the key would give one visitor two sessions
   * invalidated separately, so signing out on `/pl` would leave `/` still
   * rendering a signed-in header.
   */
  it('carries no locale', () => {
    const localeCodes: string[] = i18n.locales.map(({ code }) => code)
    const key: readonly string[] = SESSION_QUERY_KEY

    expect(key.filter((part) => localeCodes.includes(part))).toEqual([])
  })
})
