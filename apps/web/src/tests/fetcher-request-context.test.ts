import { requestHandler } from '@tanstack/react-start/server'
import {
  fetcherServer,
  getForwardedApiHeaders,
  saveApiCookies,
} from '@vitnode/core/tanstack/fetcher/server'
import { Hono } from 'hono'
import { deleteCookie } from 'hono/cookie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { API_BASE, PLUGIN_ID } from './api-bridge-contract'

const WEB_ORIGIN = 'https://web.test'

/**
 * The fetcher against a made-up route table.
 *
 * These tests are about what crosses the wire, so they call routes the fixture
 * below defines rather than the real ones, and the route-literal inference is
 * out of the way. `@vitnode/core/tanstack/auth/server` is where that inference is exercised for
 * real - it only compiles if the module, path and method line up.
 */
const callFetcher = fetcherServer as unknown as (
  moduleReturn: { pluginId: string },
  options: { method: string; module: string; path: string },
) => Promise<Response>

/** The real one drags in Hono, Drizzle and the plugin tree; only `pluginId` is read. */
const usersModule = { pluginId: PLUGIN_ID }

interface Recorded {
  headers: Record<string, string>
  path: string
}

/**
 * A stand-in for the mounted API that records what reached it and answers with
 * the two cookies the real one mints on a first request.
 */
const createApi = (recorded: Recorded[]) => {
  const plugin = new Hono()

  plugin.get('/users/session', (c) => {
    recorded.push({
      headers: Object.fromEntries(c.req.raw.headers.entries()),
      path: new URL(c.req.url).pathname,
    })
    c.header('set-cookie', 'vitnode_auth=token; Path=/; HttpOnly', {
      append: true,
    })
    c.header('set-cookie', 'vitnode_device=device; Path=/; HttpOnly', {
      append: true,
    })

    return c.json({ user: { id: 7, name: 'Test' } })
  })

  plugin.get('/users/rate-limited', (c) =>
    c.json({ message: 'slow down' }, 429),
  )

  plugin.get('/users/sign-out', (c) => {
    // `hono/cookie`'s own helper rather than a hand-written header: the whole
    // question is what the real API sends, and it sends `name=; Max-Age=0` with
    // no `Expires` to fall back on.
    deleteCookie(c, 'vitnode_auth', { path: '/' })

    return c.json({ ok: true })
  })

  plugin.get('/users/remember-device', (c) => {
    c.header('set-cookie', 'vitnode_device=device; Path=/; Max-Age=31536000', {
      append: true,
    })

    return c.json({ ok: true })
  })

  const app = new Hono().basePath('/api')
  app.route(`/${PLUGIN_ID}`, plugin)

  return app
}

/**
 * Runs `handler` the way the server runtime runs a request, so the
 * `getRequest*` helpers have a request to read - the same `requestHandler` that
 * wraps every real TanStack Start request.
 */
const withRequest = async <T>(
  init: { headers?: Record<string, string> },
  handler: () => Promise<T> | T,
): Promise<{ result: T; setCookie: string[] }> => {
  let result!: T

  const response = await requestHandler(async () => {
    result = await handler()

    return new Response(null, { status: 204 })
  })(new Request(`${WEB_ORIGIN}/`, init), {})

  return { result, setCookie: response.headers.getSetCookie() }
}

describe('SSR request context reaches the API', () => {
  let recorded: Recorded[]
  const realFetch = globalThis.fetch

  beforeEach(() => {
    recorded = []
    const api = createApi(recorded)
    process.env.NEXT_PUBLIC_API_URL = WEB_ORIGIN
    // The fetcher builds an absolute URL and calls `fetch`; the API is answered
    // in-process here so the test stays a unit test with no server to start.
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) =>
      api.fetch(new Request(input, init))
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  describe('getForwardedApiHeaders', () => {
    it('forwards the cookie, user-agent and forwarded IP of the page request', async () => {
      const { result } = await withRequest(
        {
          headers: {
            authorization: 'Bearer should-not-travel',
            cookie: 'vitnode_auth=s3cr3t; vitnode_device=d3v1c3',
            host: 'web.test',
            origin: WEB_ORIGIN,
            referer: `${WEB_ORIGIN}/`,
            'user-agent': 'Mozilla/5.0 (SSR test)',
            'x-forwarded-for': '203.0.113.7, 70.41.3.18',
          },
        },
        () => getForwardedApiHeaders(),
      )

      expect(result).toStrictEqual({
        Cookie: 'vitnode_auth=s3cr3t; vitnode_device=d3v1c3',
        'user-agent': 'Mozilla/5.0 (SSR test)',
        // Verbatim, chain included: the API stores this value, so re-deriving it
        // would record this server's hop as the visitor's IP.
        'x-forwarded-for': '203.0.113.7, 70.41.3.18',
      })
    })

    it('forwards nothing the API trusts but the request does not own', async () => {
      const { result } = await withRequest(
        {
          headers: {
            authorization: 'Bearer should-not-travel',
            'content-length': '0',
            host: 'web.test',
            origin: 'https://attacker.test',
            referer: 'https://attacker.test/',
            'x-vitnode-captcha-token': 'not-from-the-client',
          },
        },
        () => getForwardedApiHeaders(),
      )

      expect(Object.keys(result).sort()).toStrictEqual([
        'Cookie',
        'user-agent',
        'x-forwarded-for',
      ])
    })

    it('sends the captcha token the caller passes, not one off the request', async () => {
      const { result } = await withRequest(
        { headers: { 'x-vitnode-captcha-token': 'spoofed' } },
        () => getForwardedApiHeaders({ captchaToken: 'solved-by-the-client' }),
      )

      expect(result['x-vitnode-captcha-token']).toBe('solved-by-the-client')
    })

    it('falls back rather than sending an empty user-agent or IP', async () => {
      const { result } = await withRequest({}, () => getForwardedApiHeaders())

      expect(result).toStrictEqual({
        Cookie: '',
        'user-agent': 'node',
        'x-forwarded-for': '0.0.0.0',
      })
    })
  })

  describe('fetcherServer', () => {
    it('reaches the route with the plugin id intact', async () => {
      const { result } = await withRequest({}, async () =>
        callFetcher(usersModule, {
          method: 'get',
          module: 'users',
          path: '/session',
        }),
      )

      expect(result.status).toBe(200)
      expect(recorded.at(0)?.path).toBe(`${API_BASE}/users/session`)
    })

    it('carries the visitor session into the call', async () => {
      const cookie = 'vitnode_auth=s3cr3t; vitnode_device=d3v1c3'
      await withRequest(
        {
          headers: {
            cookie,
            'user-agent': 'Mozilla/5.0 (SSR test)',
            'x-forwarded-for': '203.0.113.7',
          },
        },
        async () =>
          callFetcher(usersModule, {
            method: 'get',
            module: 'users',
            path: '/session',
          }),
      )

      // Without this the API answers as an anonymous visitor: signed-out HTML
      // for a signed-in user, and every render sharing one rate-limit bucket.
      expect(recorded.at(0)?.headers).toMatchObject({
        cookie,
        'user-agent': 'Mozilla/5.0 (SSR test)',
        'x-forwarded-for': '203.0.113.7',
      })
    })

    it('does not leak the page request headers the allowlist leaves out', async () => {
      await withRequest(
        { headers: { authorization: 'Bearer nope', origin: WEB_ORIGIN } },
        async () =>
          callFetcher(usersModule, {
            method: 'get',
            module: 'users',
            path: '/session',
          }),
      )

      const headers = recorded.at(0)?.headers ?? {}
      expect(headers.authorization).toBeUndefined()
      expect(headers.origin).toBeUndefined()
    })

    it('surfaces a non-200 to the caller instead of throwing', async () => {
      const { result } = await withRequest({}, async () =>
        callFetcher(usersModule, {
          method: 'get',
          module: 'users',
          path: '/rate-limited',
        }),
      )

      expect(result.status).toBe(429)
    })
  })

  describe('saveApiCookies', () => {
    const call = async (path: string) =>
      await callFetcher(usersModule, { method: 'get', module: 'users', path })

    it('puts every cookie the API minted on this response', async () => {
      const { setCookie } = await withRequest({}, async () => {
        const response = await callFetcher(usersModule, {
          method: 'get',
          module: 'users',
          path: '/session',
        })

        saveApiCookies(response)
      })

      // Both, not just the last one: the session cookie signs the visitor in and
      // the device cookie is half of the key the session is stored under, so
      // losing either signs them straight back out.
      expect(setCookie).toEqual([
        'vitnode_auth=token; Path=/; HttpOnly',
        'vitnode_device=device; Path=/; HttpOnly',
      ])
    })

    it('carries a lifetime through instead of downgrading it to a session', async () => {
      const { setCookie } = await withRequest({}, async () => {
        saveApiCookies(await call('/remember-device'))
      })

      // Dropped, the device cookie lasts until the browser closes - and a new
      // device row is written on the visitor's next visit.
      expect(setCookie).toEqual([
        'vitnode_device=device; Max-Age=31536000; Path=/',
      ])
    })

    it('forwards a sign-out as a deletion rather than an empty cookie', async () => {
      const { setCookie } = await withRequest({}, async () => {
        saveApiCookies(await call('/sign-out'))
      })

      // `Max-Age=0` is the entire instruction here. Without it the browser is
      // told to hold an empty `vitnode_auth` for the rest of the session, so the
      // cookie the visitor just signed out of survives the sign-out.
      expect(setCookie).toEqual(['vitnode_auth=; Max-Age=0; Path=/'])
    })

    it('writes nothing for a response that set no cookies', async () => {
      const { setCookie } = await withRequest({}, () => {
        saveApiCookies(new Response(null))
      })

      expect(setCookie).toEqual([])
    })
  })
})
