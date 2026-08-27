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
    const { html } = await renderPage(at('/pl'))

    expect(testId(html, 'loading')).toBe('Loading...')
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
  })

  it('404s an unknown first segment instead of guessing a locale', async () => {
    const { html, status } = await renderPage(at('/xx'))

    // No `{-$locale}` layout route exists to match this, which is the point:
    // there is nothing to accidentally render `/xx` as a valid page.
    expect(status).toBe(404)
    expect(testId(html, 'locale')).toBeUndefined()
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
