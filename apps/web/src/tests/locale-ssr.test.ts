import { LOCALE_COOKIE_NAME } from '@vitnode/core/lib/i18n/locale-cookie'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { API_BASE, createApiFixture } from './api-bridge-contract'
import { renderPage } from './start-runtime/ssr-handler'

/**
 * These tests boot the whole application - React, `@vitnode/core`, the plugin
 * registry, every message file - on the first render. Under `turbo test`, with
 * the other packages' suites competing for the same cores, that first one has
 * been seen to take longer than Vitest's five-second default, and a timeout
 * there says nothing about the code. The warm-up below pays that cost once, and
 * every assertion after it runs in milliseconds.
 */
vi.setConfig({ hookTimeout: 60_000, testTimeout: 60_000 })

const ORIGIN = 'https://vitnode.test'
const at = (path: string) => new URL(path, ORIGIN).href

/** The value of a `data-testid` span in the rendered document. */
const testId = (html: string, id: string): string | undefined =>
  new RegExp(`data-testid="${id}"[^>]*>([^<]*)<`).exec(html)?.[1]

const langOf = (html: string): string | undefined =>
  /<html[^>]*\blang="([^"]*)"/.exec(html)?.[1]

/**
 * The real request path, end to end.
 *
 * `renderPage` drives TanStack Start's own request handler over this app's real
 * route tree: the middleware chain in `src/start.ts`, route matching through the
 * locale rewrite, the root route's `beforeLoad` and loader, the server function
 * that loads the messages, and React rendering to HTML. What comes back is what
 * a browser would receive. Only the built asset manifest is stubbed.
 *
 * Everything else in this suite tests a rule in isolation; this is the one that
 * tests that the rules are wired to each other.
 */
beforeAll(async () => {
  await renderPage(at('/'))
})

describe('SSR serves one page in two languages', () => {
  it('renders the default locale at the unprefixed URL', async () => {
    const { html, status } = await renderPage(at('/'))

    expect(status).toBe(200)
    expect(langOf(html)).toBe('en')
    expect(testId(html, 'locale')).toBe('en')
    expect(testId(html, 'close')).toBe('Close')
  })

  it('renders Polish at the prefixed URL - the same route', async () => {
    const { html, status } = await renderPage(at('/pl'))

    expect(status).toBe(200)
    expect(langOf(html)).toBe('pl')
    expect(testId(html, 'locale')).toBe('pl')
    expect(testId(html, 'close')).toBe('Zamknij')
  })

  it('falls back to English for a key Polish does not translate', async () => {
    // The rule this pins is that a language may be incomplete: `toggle_sidebar`
    // is AdminCP copy the Polish override does not carry, and it renders in
    // English on a page whose every other string is Polish. A translation is
    // merged key by key over the default locale, never all-or-nothing.
    const { html } = await renderPage(at('/pl'))

    expect(testId(html, 'fallback')).toBe('Toggle Sidebar')
  })

  it('gives the two URLs the same route and different public hrefs', async () => {
    const [en, pl] = await Promise.all([
      renderPage(at('/')),
      renderPage(at('/pl')),
    ])

    // One route file, two public URLs. `/` and `/pl` are `/` internally.
    expect(en.html).toContain('/<!-- --> \u2192 <!-- -->/')
    expect(pl.html).toContain('/<!-- --> \u2192 <!-- -->/pl')
  })

  it('prefixes the links it renders with the current locale', async () => {
    const { html } = await renderPage(at('/pl'))

    // `<Link to="/">` through `rewrite.output`.
    expect(html).toMatch(/<a[^>]*href="\/pl"/)
  })

  it('ignores the cookie on a public URL', async () => {
    // The mandatory rule: a public URL is the language it says it is, whatever
    // this visitor last chose. Anything else is one URL with two bodies.
    const { html } = await renderPage(at('/'), {
      headers: { cookie: `${LOCALE_COOKIE_NAME}=pl` },
    })

    expect(langOf(html)).toBe('en')
    expect(testId(html, 'close')).toBe('Close')
  })

  it('ignores Accept-Language on a public URL', async () => {
    const { html } = await renderPage(at('/'), {
      headers: { 'accept-language': 'pl-PL,pl;q=0.9,en;q=0.8' },
    })

    expect(langOf(html)).toBe('en')
  })
})

describe('SSR canonicalises the default locale away', () => {
  it.each([
    ['/en', '/'],
    ['/en/', '/'],
    ['/en/search?q=foo&page=2', '/search?q=foo&page=2'],
  ])('%s redirects permanently to %s', async (from, to) => {
    const { headers, status } = await renderPage(at(from))

    expect(status).toBe(308)
    expect(headers.get('location')).toBe(to)
  })

  it('strips a locale prefix from a route that never has one', async () => {
    const { headers, status } = await renderPage(at('/pl/admin/users'))

    expect(status).toBe(308)
    expect(headers.get('location')).toBe('/admin/users')
    // Carried on the redirect itself - see `server/locale.server.ts`.
    expect(headers.getSetCookie().at(0)).toContain(`${LOCALE_COOKIE_NAME}=pl`)
  })

  it('gives the API no locale cookie when it strips one', async () => {
    const { headers, status } = await renderPage(at('/pl/api/foo'))

    expect(status).toBe(308)
    expect(headers.get('location')).toBe('/api/foo')
    expect(headers.getSetCookie()).toEqual([])
  })

  it('404s an unknown first segment instead of guessing a locale', async () => {
    const { html, status } = await renderPage(at('/xx'))

    // No `{-$locale}` layout route exists to match this, which is the point:
    // there is nothing to accidentally render `/xx` as a valid page.
    expect(status).toBe(404)
    expect(testId(html, 'locale')).toBeUndefined()
  })
})

/**
 * A route with no locale in its URL, over a real request.
 *
 * `/admin` has not been migrated yet, so these render the 404 shell - which is
 * exactly what makes them useful: `<html lang>` is decided by the root document
 * either way, so the locale contract for an ignored path is observable long
 * before the AdminCP arrives.
 */
describe('SSR resolves an ignored route from the cookie, and nothing else', () => {
  it('renders it in the stored language', async () => {
    const { html } = await renderPage(at('/admin'), {
      headers: { cookie: `${LOCALE_COOKIE_NAME}=pl` },
    })

    expect(langOf(html)).toBe('pl')
  })

  it('falls back to the default with no cookie', async () => {
    const { html } = await renderPage(at('/admin'))

    expect(langOf(html)).toBe('en')
  })

  it('ignores Accept-Language, so the client can agree with it', async () => {
    // The shared helper can negotiate; this runtime deliberately does not wire
    // it up. The browser cannot read request headers, so a server that answered
    // `pl` here would hydrate to `en` - a flash of the wrong language and a
    // React hydration mismatch on every first visit.
    const { html } = await renderPage(at('/admin'), {
      headers: { 'accept-language': 'pl-PL,pl;q=0.9,en;q=0.8' },
    })

    expect(langOf(html)).toBe('en')
  })

  it('is the language a localized URL just asked for, once redirected', async () => {
    // The two halves of the fix, in sequence: the redirect hands back the
    // cookie, and the followed URL renders in that language.
    const redirected = await renderPage(at('/pl/admin'))
    const cookie = redirected.headers
      .getSetCookie()
      .find((value) => value.startsWith(LOCALE_COOKIE_NAME))

    expect(redirected.status).toBe(308)
    expect(redirected.headers.get('location')).toBe('/admin')
    expect(cookie).toBeDefined()

    const followed = await renderPage(at('/admin'), {
      headers: { cookie: cookie?.split(';')[0] ?? '' },
    })

    expect(langOf(followed.html)).toBe('pl')
  })
})

describe('SSR remembers an explicit choice, and only that', () => {
  it('sets the cookie when the visitor asks for a prefixed URL', async () => {
    const { headers } = await renderPage(at('/pl'))

    const cookie = headers
      .getSetCookie()
      .find((value) => value.startsWith(LOCALE_COOKIE_NAME))

    expect(cookie).toContain(`${LOCALE_COOKIE_NAME}=pl`)
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Secure')
  })

  it('sets nothing when the cookie already agrees', async () => {
    const { headers } = await renderPage(at('/pl'), {
      headers: { cookie: `${LOCALE_COOKIE_NAME}=pl` },
    })

    expect(headers.getSetCookie()).toEqual([])
  })

  it('does not overwrite a stored choice from an unprefixed URL', async () => {
    const { headers } = await renderPage(at('/'), {
      headers: { cookie: `${LOCALE_COOKIE_NAME}=pl` },
    })

    expect(headers.getSetCookie()).toEqual([])
  })
})

/**
 * Stage 1's bridge, still where it was.
 *
 * The locale middleware runs before route matching, which is upstream of the
 * `/api/$` server route - so this is the assertion that it did not quietly start
 * rewriting the API's URLs.
 */
describe('the API is outside all of it', () => {
  it('reaches the Hono application untouched', async () => {
    const fixture = createApiFixture()
    const response = await fixture.app.fetch(
      new Request(at(`${API_BASE}/echo?q=foo`)),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      method: 'GET',
      path: `${API_BASE}/echo`,
    })
  })

  it('is never redirected or given a locale cookie', async () => {
    const { headers, status } = await renderPage(at(`${API_BASE}/anything`))

    expect(status).not.toBe(308)
    expect(headers.getSetCookie()).toEqual([])
  })
})
