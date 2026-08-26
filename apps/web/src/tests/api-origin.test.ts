import { requestHandler } from '@tanstack/react-start/server'
import { Hono } from 'hono'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetcherServer, resolveApiOrigin } from '#/server/fetcher.server'

import { API_BASE, PLUGIN_ID } from './api-bridge-contract'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '../..')
const repoRoot = resolve(appRoot, '../..')

/**
 * The port `pnpm dev` in this app actually listens on, read out of the script
 * that starts it rather than restated here - restating it is how the two drift.
 */
const devPort = (app: string): string => {
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, 'apps', app, 'package.json'), 'utf8'),
  ) as { scripts?: Record<string, string> }

  // `next dev` with no flag serves 3000; `vite dev` needs the flag to move off
  // its own default, so an explicit `--port` is the only thing worth reading.
  return /--port[= ](\d+)/.exec(manifest.scripts?.dev ?? '')?.[1] ?? '3000'
}

const exampleEnv = (app: string): Record<string, string> =>
  Object.fromEntries(
    readFileSync(join(repoRoot, 'apps', app, '.env.example'), 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .map((line) => {
        const at = line.indexOf('=')

        return [line.slice(0, at), line.slice(at + 1)] as const
      }),
  )

interface Recorded {
  origin: string
  path: string
}

/** A stand-in for the mounted API that records the URL it was called on. */
const createApi = (recorded: Recorded[]) => {
  const plugin = new Hono()

  plugin.get('/users/session', (c) => {
    const url = new URL(c.req.url)
    recorded.push({ origin: url.origin, path: url.pathname })

    return c.json({ user: null })
  })

  const app = new Hono().basePath('/api')
  app.route(`/${PLUGIN_ID}`, plugin)

  return app
}

/** Runs `handler` inside a request, the way the server runtime runs one. */
const withRequest = async <T>(
  url: string,
  headers: Record<string, string>,
  handler: () => Promise<T> | T,
): Promise<T> => {
  let result!: T

  await requestHandler(async () => {
    result = await handler()

    return new Response(null, { status: 204 })
  })(new Request(url, { headers }), {})

  return result
}

describe('development configuration', () => {
  const env = exampleEnv('web')

  it('points both public URLs at the port this app serves', () => {
    // The bug this pins: `vite dev --port 3001` with the URLs left on 3000.
    // Every browser-side API call then leaves this app entirely.
    const origin = `http://localhost:${devPort('web')}`

    expect(env.NEXT_PUBLIC_WEB_URL).toBe(origin)
    expect(env.NEXT_PUBLIC_API_URL).toBe(origin)
  })

  it('keeps the API on the same origin as the web app', () => {
    // The API is mounted at `/api/*` in this process, so a different origin here
    // is always a mistake rather than a deployment choice.
    expect(new URL(env.NEXT_PUBLIC_API_URL ?? '').origin).toBe(
      new URL(env.NEXT_PUBLIC_WEB_URL ?? '').origin,
    )
  })

  it('does not share a development origin with the Next.js app', () => {
    // `apps/docs` serves its own VitNode API on 3000 under a Next.js catch-all.
    // Colliding with it means this app's calls are answered by that one - a
    // different database connection, a different session store, and no error.
    expect(env.NEXT_PUBLIC_API_URL).not.toBe(
      exampleEnv('docs').NEXT_PUBLIC_API_URL,
    )
    expect(devPort('web')).not.toBe(devPort('docs'))
  })
})

describe('resolveApiOrigin', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is the origin of the request being handled', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3000')

    // Not the configured value: the API is served by this process, so the
    // origin that reached it is the origin to call back on.
    await expect(
      withRequest('http://localhost:3001/session-check', {}, resolveApiOrigin),
    ).resolves.toBe('http://localhost:3001')
  })

  it('works on a hostname nobody configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://vitnode.com')

    // A preview deployment: the hostname is generated per branch, so no
    // environment variable could have named it ahead of time.
    await expect(
      withRequest(
        'https://web-git-feat-tanstack-abc123.vercel.app/',
        {},
        resolveApiOrigin,
      ),
    ).resolves.toBe('https://web-git-feat-tanstack-abc123.vercel.app')
  })

  it('follows x-forwarded-proto so a proxied http server calls itself over https', async () => {
    // The production shape: TLS ends at the proxy and this server listens on
    // plain HTTP. Calling `http://` back through that proxy is a redirect at
    // best and a refused connection at worst.
    await expect(
      withRequest(
        'http://web.test/',
        { 'x-forwarded-proto': 'https' },
        resolveApiOrigin,
      ),
    ).resolves.toBe('https://web.test')
  })

  it('ignores x-forwarded-host', async () => {
    // A header the visitor can set, on calls that carry the visitor's cookies:
    // honouring it would let a request send this server's API traffic - session
    // cookie attached - to a host of the caller's choosing.
    await expect(
      withRequest(
        'https://web.test/',
        { 'x-forwarded-host': 'attacker.test' },
        resolveApiOrigin,
      ),
    ).resolves.toBe('https://web.test')
  })

  it('falls back to NEXT_PUBLIC_API_URL outside a request', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com')

    // Boot, a script, a cron job: there is no request to read, and the
    // configured value is all there is.
    expect(resolveApiOrigin()).toBe('https://api.example.com')
  })
})

describe('SSR calls through fetcherServer', () => {
  let recorded: Recorded[]
  const realFetch = globalThis.fetch

  beforeEach(() => {
    recorded = []
    const api = createApi(recorded)
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) =>
      api.fetch(new Request(input, init))
  })

  afterEach(() => {
    globalThis.fetch = realFetch
    vi.unstubAllEnvs()
  })

  const callSession = async () =>
    (
      fetcherServer as unknown as (
        moduleReturn: { pluginId: string },
        options: { method: string; module: string; path: string },
      ) => Promise<Response>
    )(
      { pluginId: PLUGIN_ID },
      {
        method: 'get',
        module: 'users',
        path: '/session',
      },
    )

  it('calls the origin the page was requested on', async () => {
    await withRequest('https://web.test/session-check', {}, callSession)

    expect(recorded.at(0)).toStrictEqual({
      origin: 'https://web.test',
      path: `${API_BASE}/users/session`,
    })
  })

  it('does not reach the Next.js app when the environment still names it', async () => {
    // The regression: `NEXT_PUBLIC_API_URL` left on 3000, which in development
    // is `apps/docs`. The call has to stay on 3001, where the mounted API is.
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3000')

    await withRequest('http://localhost:3001/session-check', {}, callSession)

    expect(recorded.at(0)?.origin).toBe('http://localhost:3001')
  })

  it('lets an explicit origin on the call win', async () => {
    // The escape hatch a genuinely separate API server needs. Nothing in this
    // app passes it; the option exists so the request-derived default is a
    // default rather than a hard-coding.
    await withRequest('https://web.test/session-check', {}, async () =>
      (
        fetcherServer as unknown as (
          moduleReturn: { pluginId: string },
          options: {
            method: string
            module: string
            origin: string
            path: string
          },
        ) => Promise<Response>
      )(
        { pluginId: PLUGIN_ID },
        {
          method: 'get',
          module: 'users',
          origin: 'https://api.example.com',
          path: '/session',
        },
      ),
    )

    expect(recorded.at(0)?.origin).toBe('https://api.example.com')
  })
})
