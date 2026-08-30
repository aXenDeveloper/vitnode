import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  applyDocumentCacheControl,
  applyRedirectCacheControl,
  DOCUMENT_CACHE_CONTROL,
} from '#/lib/document-headers'

const here = dirname(fileURLToPath(import.meta.url))
const appSrc = resolve(here, '..')

/**
 * What a VitNode document is allowed to say about being stored.
 *
 * Pure header arithmetic over `Response` objects built in the test - no server,
 * no request, no render. What is being pinned is the *rule*, because the rule is
 * the part that fails silently: a page whose `Cache-Control` is missing looks
 * identical to one whose `Cache-Control` is right, until something in front of
 * the app decides to store it.
 *
 * The body of every one of these documents carries a dehydrated Query cache
 * holding `["vitnode","session"]`, and inside `/admin` an administrator's whole
 * permission set. Both query definitions already say in prose that the document
 * is personalised; this is where the response finally says it back.
 */

const html = (headers: Record<string, string> = {}): Response =>
  new Response('<!doctype html>', {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  })

const cacheControl = (response: Response): null | string =>
  response.headers.get('cache-control')

describe('a rendered document', () => {
  it('is marked private and unstorable', () => {
    const response = html()

    applyDocumentCacheControl(response)

    expect(cacheControl(response)).toBe(DOCUMENT_CACHE_CONTROL)
  })

  /**
   * The two halves of the directive, asserted as behaviour rather than as a
   * string, so a future rewording that dropped one of them fails.
   *
   * `private` bars a shared cache - a CDN, a proxy - which is the deployment
   * risk Stage 15 introduces. `no-store` bars the browser's own disk cache too,
   * which is the shared-machine risk: an administrator's permission set should
   * not be recoverable after they have signed out and walked away.
   */
  it('bars both a shared cache and the browser store', () => {
    const response = html()

    applyDocumentCacheControl(response)

    expect(cacheControl(response)).toContain('private')
    expect(cacheControl(response)).toContain('no-store')
  })

  /** A page that wrote a locale cookie is a document like any other. */
  it('is covered even when it just set a cookie', () => {
    const response = html({ 'set-cookie': 'vitnode-locale=pl; Path=/' })

    applyDocumentCacheControl(response)

    expect(cacheControl(response)).toBe(DOCUMENT_CACHE_CONTROL)
  })

  /**
   * A default, not an override. A route that has decided its own caching keeps
   * that decision; this exists for the documents that said nothing.
   */
  it('leaves a directive a route already chose', () => {
    const response = html({ 'cache-control': 'public, max-age=60' })

    applyDocumentCacheControl(response)

    expect(cacheControl(response)).toBe('public, max-age=60')
  })
})

/**
 * The API reaches this middleware too, and must come out of it untouched.
 *
 * `/api/*` is served by the Hono bridge through the same request middleware, and
 * a bare `GET` from it carries no `Cache-Control` of its own. A rule that
 * applied to every response would quietly forbid every API client from caching
 * anything - which is not this middleware's decision to make, and would be
 * invisible until somebody measured it.
 */
describe('everything that is not a document', () => {
  it.each([
    ['application/json', 'an API response'],
    ['image/png', 'an asset'],
    ['text/plain', 'robots.txt'],
    ['application/javascript', 'a client chunk'],
  ])('leaves %s alone (%s)', (contentType) => {
    const response = new Response('{}', {
      headers: { 'content-type': contentType },
    })

    applyDocumentCacheControl(response)

    expect(cacheControl(response)).toBeNull()
  })

  it('leaves a response with no content type alone', () => {
    const response = new Response(null, { status: 204 })

    applyDocumentCacheControl(response)

    expect(cacheControl(response)).toBeNull()
  })
})

/**
 * The locale redirect, which is a different question with a different answer.
 *
 * A `308` from `/en/discover` to `/discover` is a fact about URLs and identical
 * for every visitor, so it stays permanently cacheable - that is most of the
 * point of answering with one. The one that carries a `Set-Cookie` is not
 * identical for every visitor, and a shared cache storing it would hand the next
 * person somebody else's chosen language.
 */
describe('a locale redirect', () => {
  const redirect = (headers: Record<string, string> = {}): Response =>
    new Response(null, {
      headers: { location: '/discover', ...headers },
      status: 308,
    })

  it('stays cacheable when it carries no cookie', () => {
    const response = redirect()

    applyRedirectCacheControl(response)

    expect(cacheControl(response)).toBeNull()
  })

  it('becomes unstorable when it writes the locale cookie', () => {
    const response = redirect({ 'set-cookie': 'vitnode-locale=pl; Path=/' })

    applyRedirectCacheControl(response)

    expect(cacheControl(response)).toBe(DOCUMENT_CACHE_CONTROL)
  })

  it('leaves a directive that is already there', () => {
    const response = redirect({
      'cache-control': 'public, max-age=3600',
      'set-cookie': 'vitnode-locale=pl; Path=/',
    })

    applyRedirectCacheControl(response)

    expect(cacheControl(response)).toBe('public, max-age=3600')
  })
})

/**
 * And that the middleware actually calls them.
 *
 * A source scan, for the reason the admin guard's assertions are scans: driving
 * this would need a running Start server, which this suite deliberately does not
 * have. Both call sites are one line each in a function a reader can hold in
 * their head, so "the call is there, after the cookie" is the whole property.
 */
describe('the request middleware applies both rules', () => {
  /**
   * Raw, not run through `withoutComments`.
   *
   * That helper's block-comment stripper is documented as naive, and this file
   * is where the naivety bites: the middleware's own comment contains the
   * literal `/api/*`, whose `/*` opens a comment the stripper then closes at the
   * next `*\/` several JSDoc blocks later - taking the call sites below with it.
   * Nothing asserted here appears in prose, so there is nothing to strip.
   */
  const startSource = () => readFileSync(join(appSrc, 'start.ts'), 'utf8')

  it('marks the rendered document', () => {
    expect(startSource()).toContain(
      'applyDocumentCacheControl(result.response)',
    )
  })

  it('marks a cookie-carrying redirect before returning it', () => {
    const source = startSource()

    expect(source).toContain('applyRedirectCacheControl(redirect)')
    expect(source.indexOf('applyRedirectCacheControl(redirect)')).toBeLessThan(
      source.indexOf('return redirect'),
    )
  })

  /**
   * After the `set-cookie` append, so a document that just wrote one is covered
   * by the same directive as one that did not - and so the ordering cannot be
   * reversed by an edit that looks harmless.
   */
  it('marks the document after the cookie has been written onto it', () => {
    const source = startSource()

    expect(
      source.indexOf("headers.append('set-cookie', setCookie)"),
    ).toBeLessThan(source.indexOf('applyDocumentCacheControl(result.response)'))
  })

  /**
   * It is the only place in the app that sets one. A second opinion about
   * document caching, in a route or an entry, is how the two start disagreeing.
   */
  it('is the only thing in the app that writes a document cache directive', () => {
    const source = readFileSync(join(appSrc, 'lib/document-headers.ts'), 'utf8')

    expect(source).toContain(DOCUMENT_CACHE_CONTROL)
    expect(startSource()).not.toMatch(/cache-control/i)
  })
})
