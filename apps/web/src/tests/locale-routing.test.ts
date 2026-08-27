import { LOCALE_COOKIE_NAME } from '@vitnode/core/lib/i18n/locale-cookie'
import { describe, expect, it } from 'vitest'

import { i18n } from '#/i18n'
import { isLocale, localeRouting } from '#/lib/i18n/shared'
import { handleLocaleRequest } from '#/server/locale.server'

const request = (path: string, headers: Record<string, string> = {}) =>
  new Request(new URL(path, 'https://vitnode.test'), { headers })

/**
 * The rules themselves live in `@vitnode/core` and are exhaustively tested
 * there. What is pinned here is this app's *instance* of them: that it serves
 * the languages `src/i18n.ts` declares, in the shape Stage 3 committed to -
 * `en` unprefixed, everything else prefixed, `/admin` and `/api` outside it.
 */
describe('this app serves the locales it declares', () => {
  it('takes them from the config rather than a hardcoded list', () => {
    expect(localeRouting.locales).toEqual(i18n.locales.map((l) => l.code))
    expect(localeRouting.defaultLocale).toBe(i18n.defaultLocale)
  })

  it('prefixes every locale but the default one', () => {
    expect(localeRouting.localePrefix).toBe('as-needed')
    expect(localeRouting.localizePathname('/discover', 'en')).toBe('/discover')
    expect(localeRouting.localizePathname('/discover', 'pl')).toBe(
      '/pl/discover',
    )
  })

  it('narrows a string to a locale', () => {
    expect(isLocale('pl')).toBe(true)
    expect(isLocale('xx')).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })
})

describe('canonical redirects', () => {
  it.each([
    ['/en', '/'],
    ['/en/discover', '/discover'],
    ['/en/search?q=foo&page=2', '/search?q=foo&page=2'],
    ['/en/discover#section', '/discover#section'],
    ['/pl/admin', '/admin'],
    ['/pl/admin/users', '/admin/users'],
    ['/pl/api/foo', '/api/foo'],
  ])('%s redirects permanently to %s', (from, to) => {
    const { redirect } = handleLocaleRequest(request(from))

    expect(redirect?.status).toBe(308)
    expect(redirect?.headers.get('location')).toBe(to)
  })

  it.each(['/', '/discover', '/pl', '/pl/discover', '/pl/discover?q=foo'])(
    'leaves the canonical URL %s alone',
    (path) => {
      expect(handleLocaleRequest(request(path)).redirect).toBeUndefined()
    },
  )

  it('never redirects the API, whatever it is asked for', () => {
    // Stage 1 mounted the whole Hono application at `/api/*`. A locale layer
    // that rewrote any of it would break every client that has a URL saved.
    for (const path of ['/api', '/api/core/members/me', '/api/en/thing']) {
      expect(handleLocaleRequest(request(path))).toEqual({})
    }
  })

  it('leaves an unknown first segment for the router to 404', () => {
    // `/xx/discover` is not "the discover page in xx" - it is a URL this app
    // does not serve, and it must not be quietly repaired into one.
    expect(handleLocaleRequest(request('/xx/discover'))).toEqual({})
  })
})

describe('the locale cookie', () => {
  const setCookieFor = (path: string, headers?: Record<string, string>) =>
    handleLocaleRequest(request(path, headers)).setCookie

  it('remembers a language the visitor asked for by URL', () => {
    const cookie = setCookieFor('/pl/discover')

    expect(cookie).toContain(`${LOCALE_COOKIE_NAME}=pl`)
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('SameSite=Lax')
  })

  it('adds Secure over HTTPS and not over plain HTTP', () => {
    expect(setCookieFor('/pl')).toContain('Secure')
    expect(
      handleLocaleRequest(new Request('http://localhost:3001/pl')).setCookie,
    ).not.toContain('Secure')
  })

  it('writes nothing when the cookie already says so', () => {
    // Otherwise every request to a prefixed URL carries a `Set-Cookie`, which
    // makes each one individually cacheable and achieves nothing else.
    expect(
      setCookieFor('/pl/discover', { cookie: `${LOCALE_COOKIE_NAME}=pl` }),
    ).toBeUndefined()
  })

  it('does not overwrite a stored choice from an unprefixed URL', () => {
    // `/discover` is English because English is the default, not because
    // anybody chose it. Writing `en` here would undo the switcher on the next
    // link somebody follows.
    expect(
      setCookieFor('/discover', { cookie: `${LOCALE_COOKIE_NAME}=pl` }),
    ).toBeUndefined()
    expect(setCookieFor('/discover')).toBeUndefined()
    expect(setCookieFor('/')).toBeUndefined()
  })

  it('writes nothing for the AdminCP or the API', () => {
    expect(setCookieFor('/admin/users')).toBeUndefined()
    expect(setCookieFor('/api/foo')).toBeUndefined()
  })
})

describe('where the language of a request comes from', () => {
  const { resolveLocale } = localeRouting

  it('is the public URL, on a public route', () => {
    expect(resolveLocale('/discover', { cookieLocale: 'pl' })).toBe('en')
    expect(resolveLocale('/pl/discover', { cookieLocale: 'en' })).toBe('pl')
  })

  it('is never Accept-Language, on a public route', () => {
    // A public URL that changed language with the browser asking for it is one
    // page with two bodies: ambiguous to a crawler, uncacheable at a CDN, and
    // a different page to whoever the link is shared with.
    expect(
      resolveLocale('/discover', { acceptLanguage: 'pl-PL,pl;q=0.9,en;q=0.8' }),
    ).toBe('en')
  })

  it('is the cookie, on a route with no locale in its URL', () => {
    expect(resolveLocale('/admin', { cookieLocale: 'pl' })).toBe('pl')
    expect(resolveLocale('/admin/users', { cookieLocale: 'pl' })).toBe('pl')
  })

  it('falls back to Accept-Language and then the default there', () => {
    expect(resolveLocale('/admin', { acceptLanguage: 'pl;q=0.9' })).toBe('pl')
    expect(resolveLocale('/admin')).toBe('en')
  })
})
