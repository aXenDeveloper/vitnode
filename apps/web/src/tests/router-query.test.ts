import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { getRouter } from '#/router'

const here = dirname(fileURLToPath(import.meta.url))
const appSrc = resolve(here, '..')

/**
 * The Stage 2 Query architecture:
 *
 *     request/router -> QueryClient -> router context -> loader
 *                    -> context.queryClient.ensureQueryData(...)
 *
 * Everything here is about *where the client lives*, because that is the part
 * that fails silently. A shared client serves one visitor's data to the next; a
 * second client makes a loader's cache invisible to the component reading it,
 * which looks like nothing worse than an extra request.
 */
describe('the router owns the QueryClient', () => {
  it('exposes it through the router context', () => {
    const router = getRouter()

    expect(router.options.context.queryClient).toBeDefined()
    expect(typeof router.options.context.queryClient.ensureQueryData).toBe(
      'function',
    )
  })

  it('lets a route loader read and warm it', async () => {
    // Exactly what a loader does - `({ context }) => context.queryClient...` -
    // with a query of the test's own so nothing depends on a real endpoint.
    const { context } = getRouter().options

    const data = await context.queryClient.ensureQueryData({
      queryFn: async () => await Promise.resolve('loaded'),
      queryKey: ['test', 'loader'],
    })

    expect(data).toBe('loaded')
    expect(context.queryClient.getQueryData(['test', 'loader'])).toBe('loaded')
  })

  it('carries the VitNode query defaults', () => {
    const { queries } =
      getRouter().options.context.queryClient.getDefaultOptions()

    expect(queries?.refetchOnMount).toBe(false)
    expect(queries?.refetchOnWindowFocus).toBe(false)
  })
})

/**
 * `getRouter` is called once per server request. A client created anywhere else -
 * at module scope, in a provider - would be shared by every visitor rendering at
 * once.
 */
describe('a server-side QueryClient is never shared across requests', () => {
  it('gives each router its own client', () => {
    const first = getRouter().options.context.queryClient
    const second = getRouter().options.context.queryClient

    expect(first).not.toBe(second)
  })

  it('does not leak cached data from one request into the next', () => {
    const first = getRouter().options.context.queryClient
    first.setQueryData(['session'], { user: 'someone' })

    const second = getRouter().options.context.queryClient

    expect(second.getQueryData(['session'])).toBeUndefined()
  })
})

/**
 * The SSR integration, which is what carries a loader's cache into the HTML and
 * back out of it on the client.
 */
describe('the Query SSR integration is installed', () => {
  it('wraps the app in exactly one QueryClientProvider', () => {
    // `setupRouterSsrQueryIntegration` installs it as the router's `Wrap`, so
    // the provider exists without any component mounting one. Which is why
    // nothing else may: two providers is two clients.
    expect(typeof getRouter().options.Wrap).toBe('function')
  })

  it('registers the dehydrate hook that streams the cache into the page', () => {
    // This test process is the server, so the integration takes its server
    // branch: the router's `dehydrate` now carries the query stream.
    expect(typeof getRouter().options.dehydrate).toBe('function')
  })

  it('is set up once, next to the client it is given', () => {
    const source = readFileSync(join(appSrc, 'router.tsx'), 'utf8')

    expect(source.match(/setupRouterSsrQueryIntegration\(/g)?.length).toBe(1)
    expect(source.match(/createVitNodeQueryClient\(/g)?.length).toBe(1)
  })
})

/**
 * Hydration creates a second client only if this app asks for one, and the way
 * it would ask is a `QueryClientProvider` or a `new QueryClient` in a component.
 * Nothing in the app may hold either.
 */
describe('nothing but the router creates a query client', () => {
  const appFiles = [
    'routes/__root.tsx',
    'routes/_main.tsx',
    'routes/_main/_authenticated/files.tsx',
    'routes/_main/discover.tsx',
    'routes/_main/index.tsx',
    'routes/_main/search.tsx',
    'lib/i18n/runtime.ts',
    'lib/i18n/shared.ts',
  ]

  it.each(appFiles)('%s mounts no QueryClientProvider', (file) => {
    const source = readFileSync(join(appSrc, file), 'utf8')

    expect(source).not.toContain('QueryClientProvider')
    expect(source).not.toContain('new QueryClient')
    expect(source).not.toContain('createVitNodeQueryClient')
  })
})
