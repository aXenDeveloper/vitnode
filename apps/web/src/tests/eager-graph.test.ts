import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { withoutComments } from './source'

/**
 * What every visitor to `/` pays for, and the two rules that keep it honest.
 *
 * `routeTree.gen.ts` imports all 38 route files statically, and TanStack Start's
 * code splitter moves only the splittable options into chunks of their own -
 * `component`, `errorComponent`, `notFoundComponent`, `pendingComponent`.
 * Everything else in a route file is evaluated when the client entry loads, on
 * every page of the application: `loader`, `beforeLoad`, `validateSearch`,
 * `loaderDeps`, `head` and `staticData`.
 *
 * That is not a subtlety a reviewer can be expected to hold in mind. It is why
 * Stage 14 found the AdminCP's users table, roles table, dashboard grid, files
 * table and integrations cards - plus `react-hook-form`, `cmdk` and `@dnd-kit` -
 * in the chunk that renders the public home page: one namespace exported its
 * loader and its screen from the same module, and a route file imported the
 * loader.
 *
 * The measured cost was ~1,549 kB raw / ~492 kB gzip in the root's eager graph.
 * Splitting the two halves took it to ~863 kB / ~291 kB without moving a single
 * component or changing what any screen renders.
 *
 * ## Why there is no byte budget here
 *
 * A `expect(bundle.size).toBeLessThan(327_419)` test fails on a dependency bump,
 * passes while a leak is offset by an unrelated saving, and never says which
 * import caused either. These two rules name the *edge* instead, which is the
 * thing a person can act on. The package half is
 * `packages/vitnode/src/tanstack/eager-graph.test.ts`.
 */
const here = dirname(fileURLToPath(import.meta.url))
const routesDir = resolve(here, '../routes')

const walk = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)

    return statSync(path).isDirectory() ? walk(path) : [path]
  })

const routeFiles = walk(routesDir).filter(
  (path) => /\.tsx?$/.test(path) && !path.endsWith('.d.ts'),
)

/**
 * The options a route file evaluates at module load, as source text.
 *
 * Deliberately crude - it slices between option keys rather than parsing - and
 * that is safe for what it is asked: every route in this application writes its
 * options as a flat object literal, and a slice that over-reaches can only ever
 * make the assertion below stricter, never blinder.
 */
const EAGER_OPTIONS = [
  'beforeLoad',
  'head',
  'loader',
  'loaderDeps',
  'params',
  'staticData',
  'validateSearch',
]

const SPLITTABLE_OPTIONS = [
  'component',
  'errorComponent',
  'notFoundComponent',
  'pendingComponent',
]

const OPTION_KEY = new RegExp(
  `^\\s{2}(?:${[...EAGER_OPTIONS, ...SPLITTABLE_OPTIONS].join('|')})\\s*[:(]`,
  'm',
)

const eagerSource = (path: string): string => {
  const source = withoutComments(path)
  // Only the route options object: `createFileRoute(...)({ … })`, ending at the
  // first `})` in column zero. Past that are the local component wrappers, whose
  // whole job is to name the screen - reading them would fail every route.
  const opened = source.indexOf('createFileRoute')

  if (opened === -1) return ''

  const closed = source.indexOf('\n})', opened)
  const options = source.slice(opened, closed === -1 ? undefined : closed)
  const chunks: string[] = []

  for (const option of EAGER_OPTIONS) {
    const start = options.search(new RegExp(`^\\s{2}${option}\\s*[:(]`, 'm'))

    if (start === -1) continue

    const rest = options.slice(start + 3)
    const next = rest.search(OPTION_KEY)

    chunks.push(next === -1 ? rest : rest.slice(0, next))
  }

  return chunks.join('\n')
}

/**
 * A rendered screen, by the naming every VitNode namespace uses for one.
 *
 * `…RouteContent`, `…ScreenContent` and `…FormContent` are components a route
 * mounts through `component:`; reaching one from an eager option means the whole
 * screen - and its editor, its table, its form stack - lands in the client
 * entry. Breadcrumbs are the deliberate exception and are checked separately
 * below.
 */
const SCREEN_SUFFIXES = /\b[A-Z][A-Za-z]*(?:Route|Screen|Form)Content\b/g

describe('route files', () => {
  it('exist, so a move cannot silently empty this suite', () => {
    expect(routeFiles.length).toBeGreaterThan(30)
  })

  /**
   * The rule, stated once: what runs before React must not name what React
   * renders.
   *
   * A route may still *import* its screen - that is what `component:` is - and
   * the splitter carries that import into the screen's own chunk. What it may
   * not do is mention the screen in a `loader` or a `staticData`, because those
   * stay behind in the entry and take the import with them.
   */
  it.each(routeFiles)('%s renders nothing before React does', (path) => {
    expect(eagerSource(path).match(SCREEN_SUFFIXES) ?? []).toEqual([])
  })
})

/**
 * Fumadocs is documentation infrastructure, and it stays out of the entry.
 *
 * Stage 16 put a whole second design system in this application - the notebook
 * layout, the MDX component map, the search client, Shiki's runtime - and route
 * options are exactly where it would have leaked out of the documentation. A
 * route's `loader` and `head` are evaluated in the client entry on *every* page:
 * `_docs.tsx`'s loader naming `DocsShellContent`, or `docs.$.tsx`'s loader
 * statically importing its MDX renderer, would put all of it in front of every
 * visitor to the front page.
 *
 * Both routes are written to avoid that - the shell reaches Fumadocs only
 * through `component`, and the page route preloads its body behind an
 * `await import()` - and this is the rule rather than the two instances of it.
 * The runtime half is `isolation.test.ts`, which walks the documentation's whole
 * graph, and the measured half is a production build: the front page's 104
 * preloaded modules contain no Fumadocs chunk.
 */
describe('the documentation runtime', () => {
  it('is named by no route eager option', () => {
    for (const path of routeFiles) {
      expect(eagerSource(path), path).not.toMatch(/fumadocs/)
    }
  })

  it('is reached by no route file outside the documentation', () => {
    const offenders = routeFiles
      .filter((path) => !/_docs|docs\.search/.test(path))
      .filter((path) => /fumadocs|collections\//.test(withoutComments(path)))

    expect(offenders).toEqual([])
  })

  /**
   * And the two documentation routes really do reach it, so the rule above is
   * not passing because nothing imports Fumadocs at all.
   */
  it('is reached by the documentation routes, through splittable options only', () => {
    const shell = withoutComments(
      routeFiles.find((path) => path.endsWith('_docs.tsx')) ?? '',
    )

    expect(shell).toMatch(/component:\s*DocsShell/)
    expect(shell).toMatch(/DocsShellContent/)
    expect(
      eagerSource(routeFiles.find((path) => path.endsWith('_docs.tsx')) ?? ''),
    ).not.toMatch(/DocsShellContent/)
  })
})

/**
 * `staticData.breadcrumb` is eager, and that is what makes it dangerous.
 *
 * A crumb is declared as an *element* so it can use hooks, which means the
 * component is referenced from a route option the splitter leaves in the entry
 * chunk. That is fine for a crumb - they are small - and ruinous when the crumb
 * lives in the same module as the screen: Stage 14 measured `AdminUserBreadcrumb`
 * holding the whole user-detail screen, its roles editor, its fields editor and
 * the search feed in the root's graph, worth ~114 kB gzip on its own.
 *
 * So a crumb gets its own module, and this asserts the shape rather than the
 * bytes.
 */
describe('breadcrumb components declared on staticData', () => {
  const withBreadcrumb = routeFiles.filter((path) =>
    /staticData:\s*\{[\s\S]*?breadcrumb:/.test(withoutComments(path)),
  )

  it('are declared by several routes', () => {
    expect(withBreadcrumb.length).toBeGreaterThan(3)
  })

  it.each(withBreadcrumb)(
    '%s imports its crumb from a crumb module',
    (path) => {
      const source = withoutComments(path)
      const used = [
        ...(source.match(/breadcrumb:\s*<([A-Z][A-Za-z]*)/g) ?? []),
      ].map((match) => match.replace(/.*<-?/, ''))

      for (const component of used) {
        const importLine = source
          .split('\n')
          .find((line) => line.includes(component) && line.includes('from'))

        // A crumb defined locally in the route file is fine: it is a wrapper, and
        // what it wraps is asserted by the package-side test.
        if (!importLine) continue

        expect(importLine).not.toMatch(/\/(?:screen|[a-z-]+-screen)['"]/)
      }
    },
  )
})

/**
 * One copy of each shared runtime, and one only.
 *
 * Two React copies mean two dispatchers and hooks that throw; two QueryClients
 * mean a loader's cache entry invisible to the component that reads it; two
 * `use-intl` module records mean a provider whose consumer cannot see it. These
 * are correctness bugs first and bundle weight second, and pnpm's store makes
 * them easy to introduce - `@tanstack/react-query-devtools` alone pulls a second
 * `@tanstack/react-query` into `node_modules/.pnpm`.
 *
 * Resolved from this application, because that is the graph that ships.
 */
describe('shared runtime singletons', () => {
  const require = createRequire(join(here, '../../package.json'))
  const corePackage = resolve(here, '../../../../packages/vitnode')

  const copiesOf = (specifier: string): string[] =>
    [
      require.resolve(specifier),
      require.resolve(specifier, {
        paths: [corePackage],
      }),
    ].map((path) => realpathSync(path))

  it.each(['react', 'react-dom', '@tanstack/react-query', 'use-intl'])(
    '%s resolves to one copy for the app and for @vitnode/core',
    (name) => {
      expect(new Set(copiesOf(name)).size).toBe(1)
    },
  )

  /**
   * React Query stays an *optional peer* of the package, and never a
   * dependency of it.
   *
   * A normal dependency would let pnpm give the package its own copy the moment
   * a host's version drifted, which is the two-QueryClient bug above with extra
   * steps. Optional, because a host that renders none of the TanStack namespaces
   * should not be made to install it.
   */
  it('keeps @tanstack/react-query an optional peer of @vitnode/core', () => {
    const core = JSON.parse(
      readFileSync(join(corePackage, 'package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>
      peerDependencies: Record<string, string>
      peerDependenciesMeta?: Record<string, { optional?: boolean }>
    }

    expect(core.peerDependencies['@tanstack/react-query']).toBeDefined()
    expect(core.peerDependenciesMeta?.['@tanstack/react-query']?.optional).toBe(
      true,
    )
    expect(core.dependencies?.['@tanstack/react-query']).toBeUndefined()
  })
})

/**
 * `ssr.external` is an architectural constraint, not a build tweak.
 *
 * The package is externalised from Vite's SSR pass so Nitro inlines its built
 * `dist` afterwards - a path that never runs the TanStack Start compiler, which
 * is precisely why the package may declare `createIsomorphicFn` and may never
 * declare `createServerFn`. Removing it also breaks the locale barrel's runtime
 * `import("./en.json")`, which resolves relative to the package's own `dist`.
 *
 * Adding `ssr.noExternal` to cut chunk count would take both guarantees with it,
 * so the setting is pinned here rather than left to a comment.
 */
describe('SSR externalisation', () => {
  it('keeps the VitNode packages out of the SSR pass', () => {
    const config = withoutComments(resolve(here, '../../vite.config.ts'))

    // The three packages, in order, and whatever else the list has grown -
    // Stage 16 added `tslib`, for a reason the config states at length and which
    // has nothing to do with these three.
    expect(config).toMatch(
      /external:\s*\[\s*'@vitnode\/core',\s*'@vitnode\/blog',\s*'@vitnode\/example',/,
    )
    expect(config).not.toMatch(/noExternal/)
  })

  /**
   * `tslib`, which is on that list for a bundling bug rather than an
   * architecture rule.
   *
   * Stated separately so the two reasons never get confused: the VitNode
   * packages are external because externalising them is what makes
   * `@vitnode/core/tanstack/*` work at all, and `tslib` is external because
   * Rolldown's CJS interop gets it wrong. Removing either breaks a production
   * build in a way no test but a rendered page would notice, so the entry is
   * pinned rather than left to a comment.
   */
  it('keeps tslib out of it too, for the Radix stack behind Fumadocs', () => {
    const config = withoutComments(resolve(here, '../../vite.config.ts'))

    expect(config).toMatch(/external:\s*\[[^\]]*'tslib'/)
  })
})
