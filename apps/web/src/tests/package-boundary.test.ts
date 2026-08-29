import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The contract between this app and `@vitnode/core/tanstack/*`, checked against
 * what the package actually ships.
 *
 * `packages/vitnode/src/tanstack/boundary.test.ts` states the same boundary from
 * the other side, over the package's *source*. This one runs after
 * `build:plugins` (turbo makes `web#test` depend on it) and so is the only place
 * that can answer the questions a consumer actually has: does the subpath this
 * app imports resolve to a file that exists, and does the `dist` a Next.js app
 * loads still contain no TanStack at all.
 *
 * Static only, on purpose. Whether a server function runs is a question for the
 * build and for `pnpm typecheck`; whether the package boundary holds is a
 * question about files and specifiers, and answering it by importing them would
 * make it a question about which environment the test happens to run in.
 */
const here = dirname(fileURLToPath(import.meta.url))
const appSrc = resolve(here, '..')
const repoRoot = resolve(here, '../../../..')
const corePackage = join(repoRoot, 'packages/vitnode')
const coreDist = join(corePackage, 'dist/src')

const SKIP_DIRECTORIES = ['.output', '.tanstack', 'dist', 'node_modules']

const filesUnder = (directory: string, extensions: RegExp): string[] => {
  if (!existsSync(directory)) return []

  const entries: string[] = []

  for (const name of readdirSync(directory)) {
    const path = join(directory, name)

    if (statSync(path).isDirectory()) {
      if (SKIP_DIRECTORIES.includes(name)) continue
      entries.push(...filesUnder(path, extensions))
      continue
    }

    if (extensions.test(name) && !name.endsWith('.d.ts')) entries.push(path)
  }

  return entries
}

/**
 * Every specifier a file imports, type-only statements included.
 *
 * The opposite choice from `isolation.test.ts`, and deliberately: that file
 * walks the graph a bundler follows, so a type import is noise. This one is
 * about the *export map*, and a subpath that only ever appears in `import type`
 * still has to resolve - `tsc` reads the same `exports` field the bundler does.
 */
const importsFrom = (path: string): string[] =>
  [
    ...readFileSync(path, 'utf8').matchAll(
      /(?:^|[^\w$.])from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']|(?:^|[\n;}])\s*import\s*["']([^"']+)["']/g,
    ),
  ]
    .map((match) => match[1] ?? match[2] ?? match[3])
    .filter((specifier): specifier is string => Boolean(specifier))

const NAMESPACE = '@vitnode/core/tanstack/'

/** Every `@vitnode/core/tanstack/*` subpath this app names, and where. */
const namespaceImports = (): { path: string; specifier: string }[] =>
  filesUnder(appSrc, /\.tsx?$/).flatMap((path) =>
    importsFrom(path)
      .filter((specifier) => specifier.startsWith(NAMESPACE))
      .map((specifier) => ({ path: relative(repoRoot, path), specifier })),
  )

const manifest = JSON.parse(
  readFileSync(join(corePackage, 'package.json'), 'utf8'),
) as { exports: Record<string, Record<string, string> | string> }

/**
 * Node's subpath-pattern resolution, as much of it as this boundary needs.
 *
 * Patterns are tried longest-base-first and, on a tie, longest-key-first, and
 * the *first* match wins outright - there is no falling through to a shorter
 * pattern when its target does not exist. That is the whole mechanism behind the
 * namespace being closed: `./tanstack/*` outranks the package-wide `./*`, so
 * `@vitnode/core/tanstack/auth/contract` resolves to
 * `dist/src/tanstack/auth/contract/index.js` and nothing else - never to the
 * `contract.js` beside it.
 */
const resolveSubpath = (specifier: string): null | string => {
  const subpath = `.${specifier.slice('@vitnode/core'.length)}`
  const patterns = Object.keys(manifest.exports)
    .filter((key) => key.includes('*'))
    .sort((a, b) => b.indexOf('*') - a.indexOf('*') || b.length - a.length)

  for (const pattern of patterns) {
    const [prefix, suffix] = pattern.split('*')
    if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) continue

    const wildcard = subpath.slice(
      prefix.length,
      subpath.length - suffix.length,
    )
    const entry = manifest.exports[pattern]
    const target = typeof entry === 'string' ? entry : entry.import

    return join(corePackage, target.replace('*', wildcard))
  }

  return manifest.exports[subpath] ? subpath : null
}

describe('the package this app depends on is built', () => {
  it('has a dist to check', () => {
    // Every assertion below is vacuously true against a missing `dist`, so the
    // one thing that must not fail silently is its absence.
    expect(
      existsSync(join(coreDist, 'views/layouts/providers.js')),
      'run `turbo build:plugins` first',
    ).toBe(true)
  })
})

describe('every TanStack subpath this app imports resolves', () => {
  it('imports at least one', () => {
    expect(namespaceImports().length).toBeGreaterThan(0)
  })

  it('names only the public spellings', () => {
    // A *feature* is a directory with an entry point, and the export map
    // publishes three spellings of one: `<feature>`, `<feature>/client` and
    // `<feature>/server`. Anything else is a feature's internals, and reaching
    // for one is the mistake this catches - it resolves to
    // `<that path>/index.js`, which is a confusing "module not found" rather
    // than an obvious "that is private".
    //
    // A feature may be nested one level, and `tanstack/admin/*` is why: the
    // AdminCP is one runtime - the session, the shell, the navigation - with a
    // screen per subdirectory (`admin/users`, `admin/staff`, `admin/cron`).
    // Flattening them would spell the panel's own name into a dozen top-level
    // features (`admin-users`, `admin-staff`, ...) and lose the fact that they
    // share a guard. `./tanstack/*` matches across a slash - Node's pattern
    // wildcard does - so `admin/users` resolves to
    // `dist/src/tanstack/admin/users/index.js` and the assertion below proves
    // that file exists.
    //
    // Two segments is the bound, because a third would be a screen's internals
    // rather than a screen.
    const offenders = namespaceImports().filter(({ specifier }) => {
      const rest = specifier.slice(NAMESPACE.length).split('/')
      const feature = ['client', 'server'].includes(rest.at(-1) ?? '')
        ? rest.slice(0, -1)
        : rest

      return feature.length === 0 || feature.length > 2
    })

    expect(offenders).toEqual([])
  })

  it('points every one at a file that exists', () => {
    const offenders = namespaceImports()
      .map(({ path, specifier }) => ({
        path,
        specifier,
        target: resolveSubpath(specifier),
      }))
      .filter(({ target }) => !target || !existsSync(target))
      .map(({ path, specifier }) => `${specifier} from ${path}`)

    expect(offenders).toEqual([])
  })

  it('resolves a known subpath through the pattern rather than the wildcard', () => {
    // The control: without it, a `resolveSubpath` that quietly matched nothing
    // would satisfy every assertion above.
    expect(resolveSubpath('@vitnode/core/tanstack/fetcher/server')).toBe(
      join(coreDist, 'tanstack/fetcher/server.js'),
    )
    expect(resolveSubpath('@vitnode/core/tanstack/fetcher')).toBe(
      join(coreDist, 'tanstack/fetcher/index.js'),
    )
  })
})

describe('the built package keeps TanStack behind the namespace', () => {
  const TANSTACK_RUNTIME = ['@tanstack/react-router', '@tanstack/react-start']

  const distFilesOutsideNamespace = () =>
    filesUnder(coreDist, /\.js$/).filter(
      (path) => !path.startsWith(`${join(coreDist, 'tanstack')}${sep}`),
    )

  const reaching = (files: string[]): string[] =>
    files
      .filter((path) =>
        importsFrom(path).some((specifier) =>
          TANSTACK_RUNTIME.some(
            (name) => specifier === name || specifier.startsWith(`${name}/`),
          ),
        ),
      )
      .map((path) => relative(repoRoot, path))

  it('has files to check', () => {
    expect(distFilesOutsideNamespace().length).toBeGreaterThan(100)
  })

  it('finds the TanStack imports inside the namespace, so the scan is real', () => {
    expect(
      reaching(filesUnder(join(coreDist, 'tanstack'), /\.js$/)),
    ).not.toEqual([])
  })

  /**
   * The promise made to `apps/docs`, which is still Next.js and has no TanStack
   * dependency at all. A single import from `views/`, `components/` or `lib/`
   * would make `@tanstack/react-router` a hard requirement of every VitNode
   * install - which is exactly what declaring it an *optional* peer says it is
   * not.
   */
  it('reaches no TanStack runtime from anything a Next.js app imports', () => {
    expect(reaching(distFilesOutsideNamespace())).toEqual([])
  })
})

describe('this app and the package share one copy of each library', () => {
  /**
   * Module identity, which is the failure this migration has already paid for
   * once: two `use-intl` records meant two React contexts, so the provider this
   * app mounted and the `useTranslations` inside a core component each saw their
   * own and every shared string rendered as `MISSING_MESSAGE`.
   *
   * `@vitnode/core` names its TanStack dependencies as *optional peers*, which
   * in a real install resolves them to the host's copy by definition. Inside
   * this monorepo the package also has them as devDependencies, so pnpm is free
   * to give it a second copy - and it does: `@tanstack/react-start` resolves to
   * two store entries here, because `apps/web` pins `@types/node@^22` and the
   * package pins `^26`, which changes Vite's peer hash, which changes esbuild's,
   * which changes react-start's.
   *
   * That particular duplicate is harmless and deliberately not asserted away:
   * `@tanstack/react-start` is a re-export façade with no state of its own.
   * Everything it re-exports *from* is on this list, because those are the
   * modules that hold something - a React context, a symbol used with `in`, a
   * request-scoped store - where a second copy is a silent bug rather than
   * duplicated bytes.
   */
  const SHARED = [
    '@tanstack/react-query',
    '@tanstack/react-router',
    '@tanstack/router-core',
    '@tanstack/start-client-core',
    '@tanstack/start-server-core',
    'react',
    'react-dom',
    'use-intl',
  ]

  /**
   * Where a package resolves from, following pnpm's symlinks to the store.
   *
   * A direct dependency is linked into the consumer's own `node_modules`. A
   * transitive one is not: pnpm puts it beside its importer inside the store, so
   * the fallback looks next to each `@tanstack/*` package the consumer *does*
   * declare - which is how `@tanstack/router-core` is found from a workspace that
   * only names `@tanstack/react-router`.
   */
  const storeEntry = (consumer: string, name: string): null | string => {
    const link = join(consumer, 'node_modules', name)
    if (existsSync(link)) return realpathSync(link)

    const scope = join(consumer, 'node_modules/@tanstack')
    if (!existsSync(scope)) return null

    for (const anchor of readdirSync(scope)) {
      const beside = join(
        dirname(realpathSync(join(scope, anchor))),
        name.split('/')[1],
      )

      if (existsSync(beside)) return realpathSync(beside)
    }

    return null
  }

  it.each(SHARED)('resolves %s to the same copy from both', (name) => {
    const fromApp = storeEntry(join(repoRoot, 'apps/web'), name)
    const fromPackage = storeEntry(corePackage, name)

    expect(fromApp, `${name} resolves from apps/web`).not.toBeNull()
    expect(fromPackage, `${name} resolves from @vitnode/core`).not.toBeNull()
    expect(fromPackage).toBe(fromApp)
  })
})

describe('the namespace holds nothing the Start compiler has to see twice', () => {
  /**
   * The same rule `packages/vitnode/src/tanstack/boundary.test.ts` states over
   * the source, checked here against the build - because the build is what the
   * host bundles, and a `dist` can be stale.
   *
   * `createServerFn` is the one that matters. The host externalises this package
   * from Vite's SSR pass, so `dist` reaches the server *uncompiled*: a server
   * function declared here answers the browser correctly over `/_serverFn/*` and
   * silently resolves to `undefined` when a loader calls it during SSR.
   */
  it.each([
    'createFileRoute',
    'createMiddleware',
    'createServerFn',
    'createStart',
  ])('ships no %s', (primitive) => {
    const offenders = filesUnder(join(coreDist, 'tanstack'), /\.js$/)
      .filter((path) =>
        new RegExp(`\\b${primitive}\\s*\\(`).test(readFileSync(path, 'utf8')),
      )
      .map((path) => relative(repoRoot, path))

    expect(offenders).toEqual([])
  })

  it('still declares them in this app, which is where they belong', () => {
    // The control, and the boundary restated: the host owns its Start instance,
    // its route tree and every server function, because those are the three
    // things the compiler has to see on both sides of the render.
    const hostSource = filesUnder(appSrc, /\.tsx?$/)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')

    expect(hostSource).toContain('createServerFn(')
    expect(hostSource).toContain('createStart(')
    expect(hostSource).toContain('createFileRoute(')
  })
})

describe('a route reaches VitNode through the namespace, not past it', () => {
  /**
   * `@vitnode/core/views/*` is where VitNode's own page implementations live,
   * and they are framework-neutral - which is exactly what makes this worth
   * pinning. A route file *can* import one directly and it will work, so nothing
   * about a green build says which spelling was used. Two of them did:
   *
   *     import { OverviewSettings } from '@vitnode/core/views/auth/settings/overview/overview'
   *     import { OverviewSettings } from '@vitnode/core/tanstack/settings'
   *
   * One feature, two entry points, and only the second is a subpath the tests
   * above can check - a deep `views/` path resolves through the package-wide
   * `./*` pattern, where nothing states what a route may reach for. So the
   * namespace re-exports the panels and this keeps routes pointed at it.
   *
   * `components/` is deliberately not on this list. That is the design system -
   * a `Button`, a `Tooltip`, the theme script - and an application renders those
   * directly in both frameworks. The rule is about VitNode's *pages*: a route
   * that needs one is asking for a feature, and a feature has a namespace.
   */
  const routeFiles = () => {
    const routes = join(appSrc, 'routes')

    return filesUnder(routes, /\.tsx?$/)
  }

  it('has route files to check', () => {
    expect(routeFiles().length).toBeGreaterThan(5)
  })

  it('never imports @vitnode/core/views/* from a route file', () => {
    const offenders = routeFiles().flatMap((path) =>
      importsFrom(path)
        .filter((specifier) => specifier.startsWith('@vitnode/core/views/'))
        .map((specifier) => `${specifier} from ${relative(repoRoot, path)}`),
    )

    expect(offenders).toEqual([])
  })

  it('still lets a route render the design system directly', () => {
    // The control, and the boundary restated: this is a rule about VitNode's
    // pages, not a ban on importing from the package outside one namespace.
    const componentImports = routeFiles().flatMap((path) =>
      importsFrom(path).filter((specifier) =>
        specifier.startsWith('@vitnode/core/components/'),
      ),
    )

    expect(componentImports).not.toEqual([])
  })
})
