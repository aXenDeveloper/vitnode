import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * The seam Stage 1 is built around.
 *
 * A bridge takes the request the browser (or the SSR loader) made to
 * `/api/*` on the web origin and answers it with whatever the Hono VitNode
 * API answers. Everything in this file is stated as behaviour of that
 * function, so any implementation - a TanStack server route, a Nitro
 * handler, a plain `fetch` proxy - can be held to it.
 */
export type ApiBridge = (request: Request) => Promise<Response> | Response

/**
 * Builds the bridge for one Hono app. Tests hand in the fixture app below so
 * the contract can assert against known routes instead of the real API, which
 * needs a database.
 */
export type ApiBridgeFactory = (app: Hono) => ApiBridge

export interface ReceivedRequest {
  body: string
  headers: Record<string, string>
  method: string
  path: string
  search: string
  url: string
}

export interface ApiFixture {
  app: Hono
  received: ReceivedRequest[]
}

/**
 * The plugin id every VitNode route is namespaced under. It contains an `@`
 * and a `/`, which is exactly the shape a bridge that re-encodes the path
 * quietly breaks - so the fixture uses the real one.
 */
export const PLUGIN_ID = '@vitnode/core'

export const API_BASE = `/api/${PLUGIN_ID}`

/**
 * A stand-in for the VitNode API, mounted the way `apps/api` mounts it:
 * `basePath("/api")` with the plugin's router underneath. It records every
 * request it is handed so the contract can assert on what actually crossed
 * the boundary.
 */
export const createApiFixture = (): ApiFixture => {
  const received: ReceivedRequest[] = []

  const plugin = new Hono()

  plugin.use('*', async (c, next) => {
    const url = new URL(c.req.url)
    received.push({
      body: await c.req.raw.clone().text(),
      headers: Object.fromEntries(c.req.raw.headers.entries()),
      method: c.req.method,
      path: url.pathname,
      search: url.search,
      url: c.req.url,
    })

    return next()
  })

  plugin.all('/echo', (c) => {
    const url = new URL(c.req.url)

    return c.json({
      method: c.req.method,
      path: url.pathname,
      query: url.searchParams.getAll('q'),
      search: url.search,
    })
  })

  plugin.post('/body', async (c) => c.json(await c.req.json(), 201))

  plugin.get('/status/:code', (c) => {
    const code = Number(c.req.param('code'))

    return c.json({ code }, code as 200)
  })

  plugin.get('/text', (c) => c.text('plain body'))

  plugin.get('/empty', (c) => c.body(null, 204))

  plugin.get('/cookies', (c) => {
    c.header('set-cookie', 'session=abc; Path=/; HttpOnly', { append: true })
    c.header('set-cookie', 'device=xyz; Path=/; HttpOnly', { append: true })
    c.header('x-vitnode-marker', 'from-hono')

    return c.json({ ok: true })
  })

  const app = new Hono().basePath('/api')
  app.route(`/${PLUGIN_ID}`, plugin)

  return { app, received }
}

const WEB_ORIGIN = 'https://web.test'

const request = (path: string, init?: RequestInit): Request =>
  new Request(new URL(path, WEB_ORIGIN), init)

/**
 * Every assertion Stage 1's `/api/*` integration has to satisfy.
 *
 * Point it at a bridge factory and the whole suite runs against it, so the
 * reference implementation and the app's real one are held to one spec.
 */
export const describeApiBridgeContract = (
  label: string,
  createBridge: ApiBridgeFactory,
): void => {
  describe(`api bridge contract: ${label}`, () => {
    let fixture: ApiFixture
    let bridge: ApiBridge

    beforeEach(() => {
      fixture = createApiFixture()
      bridge = createBridge(fixture.app)
    })

    describe('reaches the Hono application', () => {
      it('answers a GET with the Hono handler response', async () => {
        const res = await bridge(request(`${API_BASE}/echo`))

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
          method: 'GET',
          path: `${API_BASE}/echo`,
          query: [],
          search: '',
        })
      })

      it('keeps the plugin id intact in the path', async () => {
        // `@vitnode/core` survives only if the bridge forwards the pathname
        // rather than rebuilding it through an encoder.
        await bridge(request(`${API_BASE}/echo`))

        expect(fixture.received.at(0)?.path).toBe(`${API_BASE}/echo`)
      })

      it.each(['DELETE', 'PATCH', 'POST', 'PUT'])(
        'forwards a %s request',
        async (method) => {
          const res = await bridge(request(`${API_BASE}/echo`, { method }))

          expect(res.status).toBe(200)
          expect(await res.json()).toMatchObject({ method })
        },
      )

      it('forwards the request body', async () => {
        const res = await bridge(
          request(`${API_BASE}/body`, {
            method: 'POST',
            body: JSON.stringify({ name: 'VitNode', tags: ['a', 'b'] }),
            headers: { 'content-type': 'application/json' },
          }),
        )

        expect(res.status).toBe(201)
        expect(await res.json()).toEqual({ name: 'VitNode', tags: ['a', 'b'] })
      })

      it('preserves the query string, repeats and encoding included', async () => {
        const res = await bridge(
          request(`${API_BASE}/echo?q=one&q=two&search=a%20b%26c`),
        )

        expect(await res.json()).toMatchObject({ query: ['one', 'two'] })
        expect(
          new URLSearchParams(fixture.received.at(0)?.search).get('search'),
        ).toBe('a b&c')
      })
    })

    describe('preserves the response', () => {
      it.each([200, 201, 400, 401, 403, 404, 409, 422, 500])(
        'passes status %i through untouched',
        async (code) => {
          const res = await bridge(request(`${API_BASE}/status/${code}`))

          expect(res.status).toBe(code)
          expect(await res.json()).toEqual({ code })
        },
      )

      it('keeps a 204 empty', async () => {
        const res = await bridge(request(`${API_BASE}/empty`))

        expect(res.status).toBe(204)
        expect(await res.text()).toBe('')
      })

      it('keeps a non-JSON body and its content type', async () => {
        const res = await bridge(request(`${API_BASE}/text`))

        expect(res.headers.get('content-type')).toContain('text/plain')
        expect(await res.text()).toBe('plain body')
      })

      it('keeps every Set-Cookie the API sent', async () => {
        // Auth lives in these. A bridge that copies headers through a plain
        // object collapses them to one and silently drops the device cookie.
        const res = await bridge(request(`${API_BASE}/cookies`))

        expect(res.headers.getSetCookie()).toEqual([
          'session=abc; Path=/; HttpOnly',
          'device=xyz; Path=/; HttpOnly',
        ])
      })

      it('keeps custom response headers', async () => {
        const res = await bridge(request(`${API_BASE}/cookies`))

        expect(res.headers.get('x-vitnode-marker')).toBe('from-hono')
      })
    })

    describe('unknown API routes', () => {
      it('answers an unknown path under a known plugin with the API 404', async () => {
        const res = await bridge(request(`${API_BASE}/nope`))

        expect(res.status).toBe(404)
        // Not the SPA shell: an unknown API path has to fail as an API call,
        // otherwise a typo'd fetch resolves with HTML and a 200-shaped body.
        expect(res.headers.get('content-type') ?? '').not.toContain('text/html')
      })

      it('answers an unknown plugin with the API 404', async () => {
        const res = await bridge(request('/api/@vitnode/unknown/echo'))

        expect(res.status).toBe(404)
      })

      it('answers `/api` itself with the API 404 rather than the app shell', async () => {
        const res = await bridge(request('/api'))

        expect(res.status).toBe(404)
      })
    })

    describe('forwards request context', () => {
      it('forwards the Cookie header verbatim', async () => {
        const cookie = 'vitnode_session=s3cr3t; vitnode_device=d3v1c3'
        await bridge(request(`${API_BASE}/echo`, { headers: { cookie } }))

        expect(fixture.received.at(0)?.headers.cookie).toBe(cookie)
      })

      it('forwards the User-Agent header verbatim', async () => {
        const userAgent =
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        await bridge(
          request(`${API_BASE}/echo`, { headers: { 'user-agent': userAgent } }),
        )

        expect(fixture.received.at(0)?.headers['user-agent']).toBe(userAgent)
      })

      it.each([
        'x-forwarded-for',
        'x-real-ip',
        'cf-connecting-ip',
        'true-client-ip',
      ])('forwards the %s header verbatim', async (header) => {
        // `globalMiddleware` reads this list in order to fill `c.get("ipAddress")`,
        // which the rate limiter, the device log and sign-up all persist.
        await bridge(
          request(`${API_BASE}/echo`, { headers: { [header]: '203.0.113.7' } }),
        )

        expect(fixture.received.at(0)?.headers[header]).toBe('203.0.113.7')
      })

      it('keeps the client first in a proxy chain', async () => {
        await bridge(
          request(`${API_BASE}/echo`, {
            headers: { 'x-forwarded-for': '203.0.113.7, 70.41.3.18' },
          }),
        )

        // The API takes the header as-is and stores it, so a bridge that
        // prepends its own hop would log the proxy as the user's IP.
        expect(fixture.received.at(0)?.headers['x-forwarded-for']).toBe(
          '203.0.113.7, 70.41.3.18',
        )
      })

      it('does not invent a client IP when the request has none', async () => {
        await bridge(request(`${API_BASE}/echo`))

        expect(
          fixture.received.at(0)?.headers['x-forwarded-for'],
        ).toBeUndefined()
      })

      it('forwards VitNode custom headers', async () => {
        await bridge(
          request(`${API_BASE}/echo`, {
            headers: { 'x-vitnode-captcha-token': 'token-123' },
          }),
        )

        expect(fixture.received.at(0)?.headers['x-vitnode-captcha-token']).toBe(
          'token-123',
        )
      })

      it('forwards the Authorization header', async () => {
        await bridge(
          request(`${API_BASE}/echo`, {
            headers: { authorization: 'Bearer abc.def' },
          }),
        )

        expect(fixture.received.at(0)?.headers.authorization).toBe(
          'Bearer abc.def',
        )
      })
    })
  })
}
