import {
  defaultParseSearch,
  defaultStringifySearch,
} from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

import {
  normalizePasswordResetSearch,
  passwordRecoveryAvailability,
  passwordResetMode,
  passwordResetNamespaces,
} from '#/lib/auth/password-reset-route'
import { postAuthDestination } from '#/lib/auth/redirects'
import {
  knownMiddlewareConfig,
  UNKNOWN_MIDDLEWARE_CONFIG,
} from '#/lib/middleware-config'
import { getRouter } from '#/router'

/**
 * The two auth routes migrated in Stage 9, as data.
 *
 * Everything here is either a pure function over a URL's query or a question put
 * to the route tree. Nothing renders and nothing is fetched: whether the
 * registration card produces the right markup is `@vitnode/core`'s business, and
 * whether the mutations reach Hono is covered by typecheck and the build.
 */

/** What the API actually puts in a recovery email: 32 random bytes, base64url. */
const TOKEN = 'PSyRy0nQ0hRnfx3iCYldQ40mBLU9lqfDWtvNhrTsJI4'

describe('the reset-password search schema', () => {
  it('keeps a well-formed recovery link', () => {
    // `?userId=123` reaches `validateSearch` as a *number*: TanStack parses each
    // value with `JSON.parse`.
    expect(normalizePasswordResetSearch({ token: TOKEN, userId: 123 })).toEqual(
      { token: TOKEN, userId: 123 },
    )
  })

  it('never coerces the account id, so the URL round-trips', () => {
    // The one thing this schema must not do. The default stringifier is
    // `JSON.parse`'s inverse, so the string '123' serialises back as
    // `?userId=%22123%22` - a different location than the one that arrived, which
    // the server's canonical-href check answers with a 307. Both spellings are
    // therefore returned exactly as they came in.
    expect(normalizePasswordResetSearch({ userId: 123 }).userId).toBe(123)
    expect(normalizePasswordResetSearch({ userId: '123' }).userId).toBe('123')
  })

  it.each([
    ['an empty token', { token: '' }],
    ['a numeric token', { token: 123 }],
    ['a boolean token', { token: true }],
    ['a listed token', { token: [TOKEN] }],
    ['a null token', { token: null }],
  ])('drops %s rather than carrying it', (_case, input) => {
    expect(normalizePasswordResetSearch(input)).not.toHaveProperty('token')
  })

  it.each([
    ['an empty account id', { userId: '' }],
    ['a boolean account id', { userId: true }],
    ['a listed account id', { userId: ['1', '2'] }],
    ['a null account id', { userId: null }],
    ['an object account id', { userId: {} }],
  ])('drops %s rather than carrying it', (_case, input) => {
    expect(normalizePasswordResetSearch(input)).not.toHaveProperty('userId')
  })

  it('answers an empty object for a bare URL, so nothing is written back', () => {
    expect(normalizePasswordResetSearch({})).toEqual({})
  })

  it('ignores parameters it does not own', () => {
    expect(
      normalizePasswordResetSearch({ returnTo: '/x', token: TOKEN, userId: 1 }),
    ).toEqual({ token: TOKEN, userId: 1 })
  })
})

describe('a recovery URL survives the router serialising it back', () => {
  /**
   * The canonical-location check, exercised against the router's own default
   * search serialisers rather than described in prose.
   *
   * `loadServerRoute` rebuilds the location from the validated search and
   * redirects when the result differs from the URL that arrived. So the schema's
   * output has to stringify back to exactly the query it was parsed from - and
   * this is the pair of functions that decides that, `JSON.parse` per value one
   * way and its inverse the other.
   */
  it.each([
    // The ordinary link.
    `?token=${TOKEN}&userId=123`,
    // A token starting with a digit, and one starting with `-`. Both trip the
    // stringifier's "does this look like JSON?" test and both fall through to
    // being returned verbatim, because neither actually parses.
    `?token=7${TOKEN.slice(1)}&userId=1`,
    `?token=-${TOKEN.slice(1)}&userId=1`,
    // The bare request form.
    '',
  ])('rebuilds %s unchanged', (search) => {
    const validated = normalizePasswordResetSearch(defaultParseSearch(search))

    expect(defaultStringifySearch(validated)).toBe(search)
  })

  it('would not, if the account id were coerced to a string', () => {
    // The control, and the reason `PasswordResetSearch.userId` is `number |
    // string`: a schema that normalised `123` to `'123'` would send every
    // recovery link through a 307 to a quoted URL.
    expect(defaultStringifySearch({ userId: 123 })).toBe('?userId=123')
    expect(defaultStringifySearch({ userId: '123' })).toBe('?userId=%22123%22')
  })
})

describe('which recovery screen a URL asks for', () => {
  it('reads a complete link as the change-password screen, carrying it parsed', () => {
    expect(passwordResetMode({ token: TOKEN, userId: 123 })).toEqual({
      link: { token: TOKEN, userId: 123 },
      mode: 'change',
    })
  })

  it('normalises a string account id into the number the API wants', () => {
    const mode = passwordResetMode({ token: TOKEN, userId: '123' })

    expect(mode.mode).toBe('change')
    expect(mode.mode === 'change' && mode.link.userId).toBe(123)
  })

  it.each([
    ['nothing at all', {}],
    ['a token with no account', { token: TOKEN }],
    ['an account with no token', { userId: 123 }],
  ])('falls back to the request screen for %s', (_case, search) => {
    // "Do not pass partially present credentials to the API", stated as a test:
    // there is no shape in which half a link reaches the change-password form.
    expect(passwordResetMode(search)).toEqual({ mode: 'request' })
  })

  it.each([
    ['a zero account id', { token: TOKEN, userId: 0 }],
    ['a negative account id', { token: TOKEN, userId: -1 }],
    ['a fractional account id', { token: TOKEN, userId: 1.5 }],
    ['a token too short to be one', { token: 'abc', userId: 1 }],
    ['a token with a path separator', { token: `../${TOKEN}`, userId: 1 }],
    ['an unbounded token', { token: 'a'.repeat(513), userId: 1 }],
  ])('falls back to the request screen for %s', (_case, search) => {
    expect(passwordResetMode(search)).toEqual({ mode: 'request' })
  })
})

describe('the namespaces each recovery screen needs', () => {
  it.each(['change', 'request'] as const)(
    'always includes the root-provider set and the title namespace in %s mode',
    (mode) => {
      // `RouteMessages` replaces the root's provider, so `core.global` has to be
      // in every set or the error toasts render their keys. The title comes from
      // `core.auth.reset_password` in *both* modes, which is what the Next.js
      // route's page-level `generateMetadata` produces.
      const namespaces = passwordResetNamespaces(mode)

      expect(namespaces).toContain('core.global')
      expect(namespaces).toContain('core.auth.reset_password')
      expect(namespaces).toContain('core.auth.sign_up')
    },
  )

  it('adds the change-password copy only in change mode', () => {
    expect(passwordResetNamespaces('change')).toContain(
      'core.auth.change_password',
    )
    expect(passwordResetNamespaces('request')).not.toContain(
      'core.auth.change_password',
    )
  })

  it('warms no more than the two screens render', () => {
    expect(passwordResetNamespaces('request')).toHaveLength(3)
    expect(passwordResetNamespaces('change')).toHaveLength(4)
  })
})

/**
 * Whether this deployment has password recovery, and the third answer.
 *
 * The decision layer only - what the route *does* with each answer is asserted
 * nowhere here, because that would mean rendering a router. What matters is that
 * three inputs produce three answers rather than two, since the bug this closes
 * was exactly two answers where three were needed.
 */
describe('whether this deployment has password recovery at all', () => {
  it('follows the email adapter when the configuration was read', () => {
    expect(passwordRecoveryAvailability({ isEmail: true, isKnown: true })).toBe(
      'available',
    )
    expect(
      passwordRecoveryAvailability({ isEmail: false, isKnown: true }),
    ).toBe('disabled')
  })

  /**
   * The regression. The fallback the config query degrades to says
   * `isEmail: false` - the right guess for the login form, which still renders
   * its fields - and reading that as a boolean made an API outage answer 404 on
   * this route: the application asserting the page does not exist because it
   * could not reach its own API.
   */
  it('does not read an unreadable configuration as "disabled"', () => {
    expect(passwordRecoveryAvailability(UNKNOWN_MIDDLEWARE_CONFIG)).toBe(
      'unknown',
    )
    expect(passwordRecoveryAvailability(UNKNOWN_MIDDLEWARE_CONFIG)).not.toBe(
      'disabled',
    )
  })

  it('is unknown whatever the fallback happens to guess', () => {
    // `isKnown` decides on its own: even were the fallback to start guessing
    // `isEmail: true`, an unread configuration still may not answer "available".
    expect(
      passwordRecoveryAvailability({ isEmail: true, isKnown: false }),
    ).toBe('unknown')
  })

  it('marks a configuration the API actually answered as known', () => {
    // The other half of the contract: a real read must not look like an outage,
    // or a deployment with no email adapter would stop answering 404.
    expect(knownMiddlewareConfig({ isEmail: false, sso: [] }).isKnown).toBe(
      true,
    )
    expect(
      passwordRecoveryAvailability(
        knownMiddlewareConfig({ isEmail: false, sso: [] }),
      ),
    ).toBe('disabled')
  })

  it('leaves the fallback usable as a login configuration', () => {
    // The degradation password recovery must not inherit, kept deliberately: an
    // outage still renders a login form, with no providers and no captcha.
    expect(UNKNOWN_MIDDLEWARE_CONFIG.isEmail).toBe(false)
    expect(UNKNOWN_MIDDLEWARE_CONFIG.sso).toEqual([])
    expect(UNKNOWN_MIDDLEWARE_CONFIG.captcha).toBeUndefined()
  })
})

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
      routeId: '/login',
    })
    expect(deepest('/login/reset-password')).toMatchObject({
      pathname: '/login/reset-password',
      routeId: '/login_/reset-password',
    })
    // Still nobody's: matched at `/login`, having consumed less than was asked.
    expect(deepest('/login/something-else')).toMatchObject({
      pathname: '/login',
      routeId: '/login',
    })
  })
})
