import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

import type { ApiBridge } from './api-bridge-contract'

import { API_BASE, createApiFixture } from './api-bridge-contract'

const WEB_ORIGIN = 'https://web.test'

/**
 * What SSR actually has to work with: the request the browser made to the
 * page, not to the API. Everything the loader sends onward has to be derived
 * from it.
 */
const ssrRequest = (path: string, headers: Record<string, string>): Request =>
  new Request(new URL(path, WEB_ORIGIN), { headers })

/**
 * Runs a loader the way the router runs it during SSR and hands back what it
 * resolved to.
 */
const loadThrough = async (loader: () => Promise<unknown>) => {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    loader,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  await router.load()

  return router.state.matches.at(-1)?.loaderData
}

describe('SSR through the Hono bridge', () => {
  it('resolves loader data from the API', async () => {
    const fixture = createApiFixture()
    const bridge: ApiBridge = async (request) => fixture.app.fetch(request)
    const incoming = ssrRequest('/', {
      cookie: 'vitnode_session=s3cr3t',
      'user-agent': 'Mozilla/5.0 (SSR test)',
      'x-forwarded-for': '203.0.113.7',
    })

    const data = await loadThrough(async () => {
      const response = await bridge(
        new Request(new URL(`${API_BASE}/echo`, incoming.url), {
          headers: incoming.headers,
        }),
      )

      return response.json()
    })

    expect(data).toMatchObject({ method: 'GET', path: `${API_BASE}/echo` })
  })

  it('carries the page request context into the API call', async () => {
    const fixture = createApiFixture()
    const incoming = ssrRequest('/', {
      cookie: 'vitnode_session=s3cr3t',
      'user-agent': 'Mozilla/5.0 (SSR test)',
      'x-forwarded-for': '203.0.113.7',
    })

    await loadThrough(async () => {
      const response = await fixture.app.fetch(
        new Request(new URL(`${API_BASE}/echo`, incoming.url), {
          headers: incoming.headers,
        }),
      )

      return response.json()
    })

    // Without this the API sees an anonymous request from the server itself:
    // signed-out SSR HTML, and every visitor sharing one rate-limit bucket.
    expect(fixture.received.at(0)?.headers).toMatchObject({
      cookie: 'vitnode_session=s3cr3t',
      'user-agent': 'Mozilla/5.0 (SSR test)',
      'x-forwarded-for': '203.0.113.7',
    })
  })

  it('surfaces an API error status to the loader instead of swallowing it', async () => {
    const fixture = createApiFixture()

    const data = await loadThrough(async () => {
      const response = await fixture.app.fetch(
        new Request(`${WEB_ORIGIN}${API_BASE}/status/403`),
      )

      return { status: response.status }
    })

    expect(data).toEqual({ status: 403 })
  })

  it('needs an absolute URL: a same-origin path alone does not resolve on the server', async () => {
    // Pins why the loader builds its URL against the incoming request. On the
    // client `fetch("/api/...")` is fine; during SSR there is no document to
    // resolve it against and it throws before Hono is ever reached.
    await expect(fetch(`${API_BASE}/echo`)).rejects.toThrow()
  })
})
