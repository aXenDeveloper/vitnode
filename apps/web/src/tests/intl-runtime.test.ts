import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appSrc = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path: string) => readFileSync(join(appSrc, path), 'utf8')

/**
 * What this app still owns of i18n, and what it must never own again.
 *
 * The runtime - locale resolution, the router rewrite, the message query, the
 * language switcher, the provider pair - lives in
 * `@vitnode/core/tanstack/i18n`. Two things cannot: the `createServerFn` that
 * fetches messages, because the Start compiler has to transform it in both
 * bundles and the package reaches the server un-compiled, and this app's own
 * language list. Both are in `src/lib/i18n/runtime.ts`, and this file pins the
 * seam between them.
 */
/** Every specifier a file imports, type-only statements included. */
const importsFrom = (path: string): string[] =>
  [
    ...readFileSync(path, 'utf8').matchAll(
      /(?:^|[^\w$.])from\s*["']([^"']+)["']/g,
    ),
  ]
    .map((match) => match[1])
    .filter((specifier): specifier is string => Boolean(specifier))

const resolveHostModule = (
  specifier: string,
  importer: string,
): null | string => {
  const base = specifier.startsWith('#/')
    ? join(appSrc, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(importer), specifier)
      : null

  if (!base) return null

  for (const suffix of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    if (existsSync(base + suffix)) return base + suffix
  }

  return null
}

/** Whether `entry` reaches `#/lib/i18n/runtime` through this app's own modules. */
const reachesRegistration = (entry: string): boolean => {
  const target = join(appSrc, 'lib/i18n/runtime.ts')
  const seen = new Set<string>()
  const stack = [join(appSrc, entry)]

  for (let next = stack.pop(); next; next = stack.pop()) {
    if (next === target) return true
    if (seen.has(next)) continue
    seen.add(next)

    for (const specifier of importsFrom(next)) {
      const resolved = resolveHostModule(specifier, next)
      if (resolved) stack.push(resolved)
    }
  }

  return false
}

describe('the package is configured before anything can use it', () => {
  /**
   * `configureIntl` runs at module scope in `src/lib/i18n/runtime.ts`, so what
   * guarantees it has run is the import graph rather than a lifecycle hook.
   *
   * These are the two modules a TanStack Start server evaluates at boot and a
   * browser evaluates before the first render: the router entry, which creates
   * the router every route hangs off, and the start entry, whose request
   * middleware runs before route matching. If either stops reaching the
   * registration, the package throws "VitNode i18n is not configured" on the
   * first request - which is a much better failure than a page silently
   * rendering in the default language, but still a failure worth catching here.
   */
  it.each(['router.tsx', 'start.ts'])(
    '%s reaches the registration',
    (entry) => {
      expect(reachesRegistration(entry)).toBe(true)
    },
  )

  it('finds a module that does not reach it, so the walk is real', () => {
    // The control: every assertion above is a "found it" one, which a walk that
    // reached everything would also satisfy.
    expect(reachesRegistration('vitnode.shell.config.ts')).toBe(false)
  })

  it('registers this app’s own language list and nothing more', () => {
    const runtime = read('lib/i18n/runtime.ts')

    expect(runtime).toMatch(/configureIntl\(\{/)
    expect(runtime).toContain("import { i18n } from '#/i18n'")
    // The one thing a package cannot declare - see the note in the module.
    expect(runtime).toMatch(/createServerFn\(\)/)
  })
})

describe('this app keeps no i18n implementation of its own', () => {
  it.each([
    'lib/i18n/client.ts',
    'lib/i18n/query.ts',
    'components/route-messages.tsx',
    'server/locale.server.ts',
  ])('has no %s', (path) => {
    // Each of these was a copy of something `@vitnode/core/tanstack/i18n` now
    // owns. Re-adding one is how the two drift.
    expect(existsSync(join(appSrc, path))).toBe(false)
  })

  it('mounts the shell messages through the package rather than by hand', () => {
    const root = read('routes/__root.tsx')
    const providers = readFileSync(
      join(
        appSrc,
        '../../../packages/vitnode/src/tanstack/layout/root-providers.tsx',
      ),
      'utf8',
    )

    // Stage 10 moved the root provider tree into the package. `RouteMessages`
    // with no namespaces provides exactly `core.global`, which is what a root
    // route wants - and it is the package that knows the provider has to be
    // mounted into two `use-intl` module records. See
    // `provider-records.test.ts` in the package, which guards that pair.
    expect(root).toContain('<VitNodeRootProviders')
    expect(providers).toContain('<RouteMessages>')
    expect(root).not.toMatch(/from 'use-intl'/)
  })

  it('reads every i18n runtime name from the package', () => {
    const offenders = [
      'routes/__root.tsx',
      'router.tsx',
      'lib/i18n/runtime.ts',
      'lib/i18n/shared.ts',
    ].filter((path) =>
      /from '#\/(lib\/i18n\/(client|query)|components\/route-messages)'/.test(
        read(path),
      ),
    )

    expect(offenders).toEqual([])
  })
})

describe('the Polish translation ships with the package', () => {
  const repoRoot = resolve(appSrc, '../../..')

  it('lives in @vitnode/core, where every installation gets it', () => {
    expect(
      existsSync(join(repoRoot, 'packages/vitnode/src/locales/pl.json')),
    ).toBe(true)
  })

  it('is not duplicated as an app override', () => {
    // It was `src/locales/@vitnode/core/pl.json`. Those are VitNode's own
    // strings, not this installation's, so a second copy here would be a fork
    // that silently stops receiving fixes.
    expect(
      existsSync(join(appSrc, 'locales/@vitnode/core/pl.json')),
      `${relative(repoRoot, appSrc)}/locales holds only app-specific overrides`,
    ).toBe(false)
  })
})
