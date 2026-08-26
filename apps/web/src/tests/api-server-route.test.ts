/**
 * `/api/*` as TanStack Start actually serves it.
 *
 * `hono-bridge.test.ts` and `stage-1-runtime.test.ts` call the bridge directly,
 * which proves the forwarding is lossless but says nothing about whether the
 * framework ever calls it. Everything here goes in through the real
 * `createStartHandler` instead, so the parts only the framework owns are under
 * test too: that `/api/$` is the route the path matches, that the single `ANY`
 * handler is picked for every method, and that a request which finds nothing in
 * the API fails as an API call rather than falling through to the app shell.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getRouter } from '#/router'
import { createApiBridge } from '#/server/api-bridge'

import type {
  ApiBridge,
  ApiBridgeFactory,
  ApiFixture,
} from './api-bridge-contract'

import {
  API_BASE,
  createApiFixture,
  describeApiBridgeContract,
} from './api-bridge-contract'
import { SHELL_BODY, startHandler } from './start-runtime/handler'

const WEB_ORIGIN = 'https://web.test'

/**
 * The methods the VitNode API needs. Its OpenAPI routes register `get`, `post`,
 * `put`, `patch` and `delete`; `cors()` answers the `OPTIONS` preflight, and
 * Hono answers `HEAD` from the matching `GET`.
 */
const METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
] as const

let bridge: ApiBridge | undefined

/**
 * The route imports the API instance at module load, and building it opens
 * Redis, starts the cron scheduler and needs Postgres. Only the bridge call is
 * under test, so the module is replaced with one that forwards to whichever
 * fixture app the running test installed - through the real `createApiBridge`,
 * so this file never becomes a second forwarder.
 */
vi.mock('#/server/vitnode-api.server', () => ({
  apiBridge: async (request: Request) => {
    if (!bridge) throw new Error('No Hono app installed for this test.')

    return bridge(request)
  },
}))

const send = async (path: string, init?: RequestInit): Promise<Response> =>
  startHandler(new Request(new URL(path, WEB_ORIGIN), init))

/**
 * The whole bridge contract, driven through the route instead of by calling the
 * bridge. Method, body, query string, request headers, response status,
 * `Set-Cookie` and the API's own 404s are all stated there once; running them
 * here proves the framework delivers them rather than only that Hono would.
 */
const throughTheRoute: ApiBridgeFactory = (app) => {
  bridge = createApiBridge(app)

  return async (request) => startHandler(request)
}

describeApiBridgeContract('apps/web /api/$ server route', throughTheRoute)

describe('the /api/$ server route', () => {
  let fixture: ApiFixture

  beforeEach(() => {
    fixture = createApiFixture()
    bridge = createApiBridge(fixture.app)
  })

  describe('method dispatch', () => {
    it.each(METHODS)('hands a %s request to Hono unchanged', async (method) => {
      await send(`${API_BASE}/echo`, { method })

      expect(fixture.received.at(-1)?.method).toBe(method)
    })

    it.each(METHODS.filter((method) => method !== 'HEAD'))(
      'answers a %s with what Hono returned',
      async (method) => {
        const res = await send(`${API_BASE}/echo`, { method })

        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ method })
      },
    )

    it('dispatches a method the framework has no name for', async () => {
      // The route declares one `ANY` handler rather than a table of methods, so
      // there is nothing to keep in sync with the API. Anything Hono is willing
      // to route arrives; a per-method table would 404 here.
      const res = await send(`${API_BASE}/echo`, { method: 'PROPFIND' })

      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ method: 'PROPFIND' })
    })

    it('lets Hono answer the CORS preflight', async () => {
      // `VitNodeAPI` mounts `cors()`, so the preflight is the API's to answer.
      // The framework has no `OPTIONS` handler of its own to answer it with.
      await send(`${API_BASE}/echo`, {
        method: 'OPTIONS',
        headers: {
          'access-control-request-method': 'POST',
          origin: 'https://app.test',
        },
      })

      const received = fixture.received.at(-1)
      expect(received?.method).toBe('OPTIONS')
      expect(received?.headers.origin).toBe('https://app.test')
    })
  })

  describe('HEAD', () => {
    it('answers with the GET status and headers and no body', async () => {
      const res = await send(`${API_BASE}/text`, { method: 'HEAD' })

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/plain')
      // Start strips the body itself when a route has no `HEAD` handler of its
      // own, which is what a HEAD response is supposed to look like.
      expect(await res.text()).toBe('')
    })

    it('keeps a Hono 404 a 404', async () => {
      const res = await send(`${API_BASE}/nope`, { method: 'HEAD' })

      expect(res.status).toBe(404)
      expect(await res.text()).toBe('')
    })
  })

  describe('request bodies', () => {
    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
      'forwards a %s body',
      async (method) => {
        const body = JSON.stringify({ name: 'VitNode' })
        await send(`${API_BASE}/echo`, {
          method,
          body,
          headers: { 'content-type': 'application/json' },
        })

        expect(fixture.received.at(-1)?.body).toBe(body)
      },
    )

    it('forwards a multipart upload', async () => {
      // Avatars and attachments arrive this way. The body is a stream, so a
      // bridge or a middleware that read it first would leave Hono nothing.
      const form = new FormData()
      form.set('name', 'VitNode')
      form.set('file', new File(['hello'], 'a.txt', { type: 'text/plain' }))

      const res = await send(`${API_BASE}/echo`, { method: 'POST', body: form })
      const received = fixture.received.at(-1)

      expect(res.status).toBe(200)
      expect(received?.headers['content-type']).toContain('multipart/form-data')
      expect(received?.body).toContain('hello')
    })
  })

  describe('never the app shell', () => {
    it('renders the shell for a page route', async () => {
      // The control for everything below it: SSR is reachable in this harness,
      // so an API path not reaching it is a decision rather than an accident.
      const res = await send('/')

      expect(res.status).toBe(200)
      expect(await res.text()).toBe(SHELL_BODY)
    })

    it.each([
      `${API_BASE}/nope`,
      `${API_BASE}/echo/`,
      '/api/@vitnode/unknown/echo',
      '/api/nonsense/deep/path',
      '/api',
    ])('answers %s with the API 404 instead', async (path) => {
      const res = await send(path)

      expect(res.status).toBe(404)
      expect(await res.text()).not.toBe(SHELL_BODY)
    })

    it('answers a request that asks for JSON', async () => {
      // The router refuses a non-HTML `Accept` with a 500, and every API client
      // sends one - so this only passes while the server route answers first.
      const res = await send(`${API_BASE}/echo`, {
        headers: { accept: 'application/json' },
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ method: 'GET' })
    })

    it('is the only route under /api', () => {
      // A page route added anywhere under `/api` outranks the splat for its own
      // path, and that path would quietly start answering HTML.
      const underApi = Object.keys(getRouter().routesById).filter(
        (id) => id === '/api' || id.startsWith('/api/'),
      )

      expect(underApi).toEqual(['/api/$'])
    })
  })

  describe('the request the API is handed', () => {
    it('is not screened by the framework before it gets there', async () => {
      // Start's default request middleware is CSRF protection scoped to server
      // functions. If a global one ever lands without that filter, every
      // cross-origin API call starts failing - which is this assertion.
      const res = await send(`${API_BASE}/body`, {
        method: 'POST',
        body: JSON.stringify({ ok: true }),
        headers: {
          'content-type': 'application/json',
          origin: 'https://other.test',
        },
      })

      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({ ok: true })
    })
  })
})
