import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import type { ApiBridgeFactory } from './api-bridge-contract'

import { describeApiBridgeContract } from './api-bridge-contract'

const here = dirname(fileURLToPath(import.meta.url))
const srcRoot = resolve(here, '..')

const EXTENSIONS = ['.ts', '.tsx']

const resolveModule = (path: string): string | undefined =>
  [path, ...EXTENSIONS.map((extension) => `${path}${extension}`)].find(
    (candidate) => existsSync(candidate) && !candidate.endsWith('/'),
  )

/**
 * Where a TanStack Start server route that owns `/api/*` can live. The
 * framework builds the path from the file name, so this is the whole surface:
 * `api.$.ts` and `api/$.ts` both resolve to `/api/$`.
 */
const routePath = ['api.$.ts', 'api.$.tsx', 'api/$.ts', 'api/$.tsx']
  .map((name) => resolve(srcRoot, 'routes', name))
  .find((path) => existsSync(path))

const importsFrom = (path: string): string[] =>
  [...readFileSync(path, 'utf8').matchAll(/from\s+["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((specifier): specifier is string => Boolean(specifier))

/** Every first-party module reachable from `entry`, as `src`-relative paths. */
const importGraphFrom = (entry: string): string[] => {
  const seen = new Set<string>()
  const queue = [entry]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined || seen.has(current)) continue
    seen.add(current)

    for (const specifier of importsFrom(current)) {
      const target = specifier.startsWith('#/')
        ? resolve(srcRoot, specifier.slice(2))
        : specifier.startsWith('.')
          ? resolve(dirname(current), specifier)
          : undefined

      const resolved = target === undefined ? undefined : resolveModule(target)
      if (resolved) queue.push(resolved)
    }
  }

  return [...seen].map((path) => relative(srcRoot, path))
}

/**
 * The app's own bridge, when it exposes one that can be pointed at an arbitrary
 * Hono app. When it does, the whole contract runs against the real
 * implementation rather than only against a reference one.
 */
const loadBridgeFactory = async (): Promise<ApiBridgeFactory | undefined> => {
  for (const specifier of ['../server/api-bridge', '../lib/api-bridge']) {
    if (!resolveModule(resolve(here, specifier))) continue

    const module = (await import(/* @vite-ignore */ specifier)) as {
      createApiBridge?: ApiBridgeFactory
    }

    if (module.createApiBridge) return module.createApiBridge
  }

  return undefined
}

const bridgeFactory = await loadBridgeFactory()

describe('Stage 1 runtime wiring', () => {
  // Skipped while the `/api/*` server route is still to be written. The skip is
  // the marker: both turn into real assertions the moment the file lands.
  it.skipIf(routePath === undefined)(
    'mounts the API on a splat route so every path under /api reaches it',
    () => {
      // `/api/@vitnode/core/users/{id}` is four segments past the mount point.
      // Anything narrower than a splat answers the app shell for most of them.
      expect(routePath).toMatch(/api[./]\$\.tsx?$/)
    },
  )

  it.skipIf(routePath === undefined || bridgeFactory === undefined)(
    'serves /api/* through the bridge this suite covers',
    () => {
      // The risk: a second forwarder written inline in the route file. The
      // contract below would still be green while production ran untested code.
      expect(importGraphFrom(routePath ?? '')).toContain('server/api-bridge.ts')
    },
  )
})

if (bridgeFactory) {
  describeApiBridgeContract('apps/web createApiBridge', bridgeFactory)
} else {
  describe.skip('api bridge contract: apps/web createApiBridge', () => {
    it('runs once src/server/api-bridge.ts exports createApiBridge(app)', () => {
      expect(bridgeFactory).toBeDefined()
    })
  })
}
