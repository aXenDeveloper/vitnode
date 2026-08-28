import { describe, expect, it } from 'vitest'

import {
  completeSsoResultFromStatus,
  isProviderRedirectUrl,
  isUsableSessionStatus,
  parseSsoCallback,
  providerIdSchema,
  shouldSaveApiCookies,
  signInInputSchema,
  signInResultFromStatus,
  signOutResultFromStatus,
  ssoCallbackInputSchema,
  ssoStartResultFromStatus,
} from '#/lib/auth/contract'

/**
 * The auth transport's decisions, without the transport.
 *
 * Every status the API can answer these four calls with, and every shape a
 * provider can send a visitor back with, mapped to the finite result a component
 * is allowed to see. No Hono, no fetch, no server function - those are covered
 * by typecheck and the build.
 */
describe('sign-in results', () => {
  it('reads 201 as signed in', () => {
    expect(signInResultFromStatus(201)).toEqual({ ok: true })
  })

  it('reads 403 as a rejected credential rather than a failure', () => {
    expect(signInResultFromStatus(403)).toEqual({
      ok: false,
      reason: 'access_denied',
    })
  })

  it.each([200, 400, 404, 409, 429, 500, 503])(
    'collapses %i into one server_error',
    (status) => {
      expect(signInResultFromStatus(status)).toEqual({
        ok: false,
        reason: 'server_error',
      })
    },
  )
})

describe('sign-out results', () => {
  it('reads 200 as signed out', () => {
    expect(signOutResultFromStatus(200)).toEqual({ ok: true })
  })

  it.each([204, 403, 429, 500])('reads %i as a failure', (status) => {
    expect(signOutResultFromStatus(status)).toEqual({
      ok: false,
      reason: 'server_error',
    })
  })
})

describe('SSO start results', () => {
  it('returns the provider URL on 200', () => {
    expect(
      ssoStartResultFromStatus(
        200,
        'https://accounts.google.com/o/oauth2/v2/auth?state=a',
      ),
    ).toEqual({
      ok: true,
      url: 'https://accounts.google.com/o/oauth2/v2/auth?state=a',
    })
  })

  it('reads 404 as a provider this install does not have', () => {
    expect(ssoStartResultFromStatus(404, undefined)).toEqual({
      ok: false,
      reason: 'unknown_provider',
    })
  })

  it.each([429, 500])('reads %i as a failure', (status) => {
    expect(ssoStartResultFromStatus(status, undefined)).toEqual({
      ok: false,
      reason: 'server_error',
    })
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    '/login',
    '',
    undefined,
    null,
    42,
  ])('refuses to hand back %j as a navigation target', (url) => {
    // The caller puts a browser at this value, so a 200 carrying something that
    // is not an http(s) URL is a broken adapter, not a redirect.
    expect(ssoStartResultFromStatus(200, url)).toEqual({
      ok: false,
      reason: 'server_error',
    })
  })

  it.each([
    'https://discord.com/oauth2/authorize?state=a',
    'http://localhost:3000/oauth?state=a',
  ])('accepts %s', (url) => {
    expect(isProviderRedirectUrl(url)).toBe(true)
  })
})

describe('SSO callback results', () => {
  it('reads 200 as signed in', () => {
    expect(completeSsoResultFromStatus(200)).toEqual({ ok: true })
  })

  it.each([
    [400, 'invalid_state'],
    [404, 'unknown_provider'],
    [409, 'email_exists'],
    [429, 'server_error'],
    [500, 'server_error'],
  ] as const)('reads %i as %s', (status, reason) => {
    expect(completeSsoResultFromStatus(status)).toEqual({ ok: false, reason })
  })
})

describe('cookie propagation rule', () => {
  it.each([200, 201, 204, 299])('copies the cookies a %i carries', (status) => {
    expect(shouldSaveApiCookies(status)).toBe(true)
  })

  it.each([301, 400, 403, 409, 429, 500])(
    'writes nothing to the browser for a %i',
    (status) => {
      expect(shouldSaveApiCookies(status)).toBe(false)
    },
  )
})

describe('provider id validation', () => {
  it.each(['google', 'discord', 'facebook', 'my-idp', 'idp_2'])(
    'accepts %s',
    (providerId) => {
      expect(providerIdSchema.safeParse(providerId).success).toBe(true)
    },
  )

  it.each([
    // The fetcher interpolates this into the request path without encoding it.
    '../../session',
    'google/../../sign_in',
    'google%2F..',
    'google?x=1',
    'google.com',
    '-google',
    '',
    'a'.repeat(65),
  ])('rejects %j', (providerId) => {
    expect(providerIdSchema.safeParse(providerId).success).toBe(false)
  })
})

describe('sign-in input validation', () => {
  it('lowercases the address the way the API does before looking it up', () => {
    const parsed = signInInputSchema.parse({
      email: 'Test@Test.com',
      password: 'Test123!',
    })

    expect(parsed).toEqual({ email: 'test@test.com', password: 'Test123!' })
  })

  it.each([
    { email: 'not-an-email', password: 'Test123!' },
    { email: 'test@test.com', password: '' },
    { email: 'test@test.com' },
    { password: 'Test123!' },
    { email: 'test@test.com', isAdmin: 'yes', password: 'Test123!' },
  ])('rejects %j', (input) => {
    expect(signInInputSchema.safeParse(input).success).toBe(false)
  })

  it('drops anything the API was not asked for', () => {
    expect(
      signInInputSchema.parse({
        email: 'test@test.com',
        isAdmin: true,
        password: 'Test123!',
        returnTo: '/settings',
      }),
    ).toEqual({ email: 'test@test.com', isAdmin: true, password: 'Test123!' })
  })
})

describe('SSO callback input normalisation', () => {
  const providerId = 'google'
  const params = { code: 'oauth-code', providerId, state: 'abcdef0123456789' }

  it('reads an approved callback', () => {
    expect(
      parseSsoCallback({
        providerId,
        query: { code: params.code, state: params.state },
      }),
    ).toEqual({ ok: true, params })
  })

  it('reads URLSearchParams as well as a search object', () => {
    expect(
      parseSsoCallback({
        providerId,
        query: new URLSearchParams({ code: params.code, state: params.state }),
      }),
    ).toEqual({ ok: true, params })
  })

  it('reads the visitor declining at the provider', () => {
    expect(
      parseSsoCallback({ providerId, query: { error: 'access_denied' } }),
    ).toEqual({ ok: false, reason: 'access_denied' })
  })

  it('classifies any other provider error without carrying its text', () => {
    const parsed = parseSsoCallback({
      providerId,
      query: {
        error: 'server_error',
        error_description: '<script>alert(1)</script>',
      },
    })

    expect(parsed).toEqual({ ok: false, reason: 'provider_error' })
  })

  it('prefers the error over a code sent alongside it', () => {
    expect(
      parseSsoCallback({
        providerId,
        query: {
          code: params.code,
          error: 'access_denied',
          state: params.state,
        },
      }),
    ).toEqual({ ok: false, reason: 'access_denied' })
  })

  it.each([
    { state: 'abcdef0123456789' },
    { code: 'oauth-code' },
    { code: '', state: 'abcdef0123456789' },
    { code: 'oauth-code', state: '' },
    { code: 'a'.repeat(2049), state: 'abcdef0123456789' },
  ])('rejects the unusable callback %j', (query) => {
    expect(parseSsoCallback({ providerId, query })).toEqual({
      ok: false,
      reason: 'invalid_callback',
    })
  })

  it.each([undefined, '', '../../session', 'google/../..'])(
    'rejects the callback of provider %j',
    (badProviderId) => {
      expect(
        parseSsoCallback({
          providerId: badProviderId,
          query: { code: params.code, state: params.state },
        }),
      ).toEqual({ ok: false, reason: 'invalid_callback' })
    },
  )

  it.each([undefined, null, 'not-a-query', 42])(
    'rejects a query of %j',
    (query) => {
      expect(parseSsoCallback({ providerId, query })).toEqual({
        ok: false,
        reason: 'invalid_callback',
      })
    },
  )

  it('feeds its params straight to the callback validator', () => {
    // The one contract between the normaliser and the server function: whatever
    // `parseSsoCallback` calls valid is what `completeSso` accepts.
    const parsed = parseSsoCallback({
      providerId,
      query: { code: params.code, state: params.state },
    })

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    expect(ssoCallbackInputSchema.safeParse(parsed.params).success).toBe(true)
  })
})

/**
 * The distinction the auth stack got wrong for a whole stage.
 *
 * `200 + { user: null }` is a visitor who is genuinely nobody. Every other
 * answer means the session could not be *evaluated*, and reading that as
 * "anonymous" is what signed people out during a rate-limit spike. There is no
 * third status the session route declares, so `200` is the whole rule.
 */
describe('reading a session response status', () => {
  it('treats 200 as a session that can be read', () => {
    expect(isUsableSessionStatus(200)).toBe(true)
  })

  it.each([204, 400, 401, 403, 404, 429, 500, 502, 503])(
    'treats %i as a failed read rather than as an anonymous visitor',
    (status) => {
      expect(isUsableSessionStatus(status)).toBe(false)
    },
  )
})
