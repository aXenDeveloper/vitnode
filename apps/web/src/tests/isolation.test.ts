import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../..')

const SKIP_DIRECTORIES = [
  '.next',
  '.output',
  '.source',
  '.turbo',
  'dist',
  'node_modules',
]

const filesUnder = (directory: string): string[] => {
  if (!existsSync(directory)) return []

  const entries: string[] = []

  for (const name of readdirSync(directory)) {
    const path = join(directory, name)

    if (statSync(path).isDirectory()) {
      if (SKIP_DIRECTORIES.includes(name)) continue
      entries.push(...filesUnder(path))
      continue
    }

    if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) entries.push(path)
  }

  return entries
}

/**
 * Type-only statements, which the compiler erases and no bundler ever follows.
 *
 * Dropped before the scan because this file walks the *runtime* graph, and the
 * app's own source - unlike the `dist` it walks into - still has its `import
 * type` lines in it. `lib/session.ts` names the API's users module purely so the
 * route literals infer; following it would report Hono, Drizzle and the whole
 * API tree as things a login screen loads.
 */
const withoutTypeImports = (source: string): string =>
  source.replace(
    /(?:^|\n)\s*(?:import|export)\s+type\s[\s\S]*?\sfrom\s*["'][^"']+["']/g,
    '\n',
  )

/**
 * Every specifier a file imports at runtime.
 *
 * Written to tolerate compiled output as well as source: a package's `dist` is
 * minified onto one line, so `from"./x.js"` carries no whitespace and its
 * statements are separated by `;` rather than by newlines. The `[^\w$.]` guard
 * before `from` keeps a property access such as `Object.from` out.
 */
const importsFrom = (path: string): string[] =>
  [
    ...withoutTypeImports(readFileSync(path, 'utf8')).matchAll(
      /(?:^|[^\w$.])from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']|(?:^|[\n;}])\s*import\s*["']([^"']+)["']/g,
    ),
  ]
    .map((match) => match[1] ?? match[2] ?? match[3])
    .filter((specifier): specifier is string => Boolean(specifier))

const matches = (specifier: string, forbidden: string): boolean =>
  specifier === forbidden || specifier.startsWith(`${forbidden}/`)

const offendersIn = (files: string[], forbidden: string[]): string[] =>
  files
    .filter((path) =>
      importsFrom(path).some((specifier) =>
        forbidden.some((entry) => matches(specifier, entry)),
      ),
    )
    .map((path) => relative(repoRoot, path))

/** Anything that only exists inside a TanStack Start app. */
const TANSTACK_ONLY = ['@tanstack/react-start', '@tanstack/react-router']

/**
 * Anything that only exists inside a Next.js app.
 *
 * `next` covers every subpath by the prefix rule in `matches` - `next/cache`,
 * `next/server`, `next/headers`, `next/dynamic`, `next/image`. They are not
 * listed one by one on purpose: a list of subpaths is a list somebody has to
 * remember to extend, and the package itself is the boundary.
 */
const NEXT_ONLY = ['next', 'server-only']

/**
 * next-intl's Next-only halves.
 *
 * The root entry is not on this list on purpose: it re-exports `use-intl`, which
 * is framework-free, and the API already uses `createTranslator` from it to
 * render emails and error messages in the user's language. These four are the
 * ones that reach for Next's request scope, its middleware or its build plugin.
 */
const NEXT_INTL_RUNTIME = [
  'next-intl/middleware',
  'next-intl/navigation',
  'next-intl/plugin',
  'next-intl/server',
]

/** Anything that only exists in a browser. */
const DOM_ONLY_GLOBALS = ['document', 'localStorage', 'navigator', 'window']

describe('the repository root is where these tests think it is', () => {
  it('resolves to the workspace root', () => {
    // Every assertion below is vacuously true against an empty file list, so
    // a move of this file has to fail here rather than silently pass.
    expect(existsSync(join(repoRoot, 'pnpm-workspace.yaml'))).toBe(true)
  })
})

describe('the import scan finds what it is looking for', () => {
  // Every assertion below is a "found nothing" one, which an import scanner
  // that silently matches nothing also satisfies. These two are the control:
  // they point it at code that provably does import the forbidden things.
  it('finds the Next.js imports in the layer that is allowed them', () => {
    expect(
      offendersIn(
        filesUnder(join(repoRoot, 'packages/vitnode/src/content/next')),
        NEXT_ONLY,
      ),
    ).not.toEqual([])
  })

  it('finds the TanStack imports in this app', () => {
    expect(
      offendersIn(filesUnder(join(repoRoot, 'apps/web/src/routes')), [
        '@tanstack/react-router',
      ]),
    ).not.toEqual([])
  })
})

describe('adding TanStack Start does not reach the rest of the workspace', () => {
  const targets = [
    // The plain `@hono/node-server` process. Neither TanStack nor Next has a
    // runtime there, so an import fails when someone boots the API, not in CI.
    {
      files: () => filesUnder(join(repoRoot, 'apps/api/src')),
      name: 'apps/api',
    },
    // Loaded by `apps/api` and executed by drizzle-kit when it reads the tables.
    {
      files: () => [
        ...filesUnder(join(repoRoot, 'packages/vitnode/src/api')),
        ...filesUnder(join(repoRoot, 'packages/vitnode/src/database')),
      ],
      name: '@vitnode/core api + database layers',
    },
    // Adapter packages: they run wherever the API runs, framework-free.
    {
      files: () =>
        [
          'elasticsearch',
          'node-cron',
          'nodemailer',
          'resend',
          's3',
          'supabase-storage',
        ].flatMap((name) =>
          filesUnder(join(repoRoot, 'packages', name, 'src')),
        ),
      name: 'framework-independent packages',
    },
  ]

  it.each(targets)('$name has files to check', ({ files }) => {
    expect(files().length).toBeGreaterThan(0)
  })

  it.each(targets)('$name never imports TanStack Start', ({ files }) => {
    expect(offendersIn(files(), TANSTACK_ONLY)).toEqual([])
  })

  it.each(targets)('$name never imports Next.js', ({ files }) => {
    expect(offendersIn(files(), NEXT_ONLY)).toEqual([])
  })

  it.each(targets)(
    "$name never imports next-intl's Next-only entries",
    ({ files }) => {
      expect(offendersIn(files(), NEXT_INTL_RUNTIME)).toEqual([])
    },
  )
})

describe('the existing Next.js application stays Next-only', () => {
  const docsFiles = () => filesUnder(join(repoRoot, 'apps/docs'))

  it('has files to check', () => {
    expect(docsFiles().length).toBeGreaterThan(0)
  })

  it('never imports TanStack Start', () => {
    expect(offendersIn(docsFiles(), TANSTACK_ONLY)).toEqual([])
  })
})

describe('the TanStack Start application stays Next-free', () => {
  const webFiles = () => filesUnder(join(repoRoot, 'apps/web/src'))

  it('has files to check', () => {
    expect(webFiles().length).toBeGreaterThan(0)
  })

  it('never imports next/* or server-only', () => {
    // `@vitnode/core` splits its Next-only helpers into their own modules
    // precisely so an app that is not Next can use the rest. Importing one
    // here would drag `next/headers` into the Nitro build.
    expect(offendersIn(webFiles(), NEXT_ONLY)).toEqual([])
  })

  it("never imports next-intl's Next-only entries", () => {
    expect(offendersIn(webFiles(), NEXT_INTL_RUNTIME)).toEqual([])
  })

  it('reaches for use-intl directly, and never for next-intl', () => {
    // There is no exception left. The root used to import `next-intl`'s
    // `IntlProvider` to cover the second module record core's components read
    // under `vite dev` (see `intl-provider.test.ts`); it now imports that record
    // from the package that owns it, `@vitnode/core/lib/i18n/provider`. The two
    // resolve to the same file today, and only one of them says why.
    //
    // Runtime files only: `intl-provider.test.ts` asserts *about* these imports,
    // so it necessarily contains the specifiers the scanner is looking for.
    const runtime = webFiles().filter(
      (path) => !path.includes(`${sep}tests${sep}`),
    )

    expect(offendersIn(runtime, ['next-intl'])).toEqual([])
  })

  it('depends on use-intl at the same version next-intl resolves', () => {
    // Two copies of `use-intl` means two React contexts: the provider this app
    // mounts and the `useTranslations` inside a core component would each see
    // their own, and every shared string would throw `MISSING_MESSAGE`.
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, 'apps/web/package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> }

    expect(manifest.dependencies?.['use-intl']).toBeDefined()
    expect(manifest.dependencies?.['use-intl']).toBe(
      manifest.dependencies?.['next-intl'],
    )
  })

  it('does not depend on next', () => {
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, 'apps/web/package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> }

    expect(manifest.dependencies?.next).toBeUndefined()
  })
})

/**
 * The graph the bundler walks, rather than the files this app happens to own.
 *
 * The tests above scan `apps/web/src` for a forbidden `import`, which catches a
 * line written here. It does not catch the more likely mistake: importing
 * something from `@vitnode/core` or a plugin whose *own* imports reach Next.js.
 * That is not hypothetical - a plugin's frontend entry
 * (`blogPlugin()`) registers AdminCP screens, which reach `next/dynamic` and
 * `next-intl/navigation`, and `apps/web/src/vitnode.config.ts` exists in the
 * shape it does because of it.
 *
 * So this walks the real thing, transitively: this app's source, then every
 * package module it reaches, as the *built* files - which is what a bundler and
 * the Nitro server actually load, and which have their type-only imports already
 * erased.
 */
describe('the whole graph this app imports stays Next-free', () => {
  const DIST_OF: Record<string, string> = {
    '@vitnode/blog': join(repoRoot, 'plugins/blog/dist/src'),
    '@vitnode/core': join(repoRoot, 'packages/vitnode/dist/src'),
    '@vitnode/example': join(repoRoot, 'plugins/example/dist/src'),
  }
  const appSrc = join(repoRoot, 'apps/web/src')
  const CANDIDATES = [
    '',
    '.ts',
    '.tsx',
    '.js',
    '/index.ts',
    '/index.tsx',
    '/index.js',
  ]

  const resolveFile = (base: string): null | string => {
    for (const suffix of CANDIDATES) {
      const path = `${base}${suffix}`
      if (existsSync(path) && statSync(path).isFile()) return path
    }

    return null
  }

  const resolveSpecifier = (
    specifier: string,
    importer: string,
  ): null | string => {
    if (specifier.startsWith('.')) {
      return resolveFile(resolve(dirname(importer), specifier))
    }

    if (specifier.startsWith('#/')) {
      return resolveFile(join(appSrc, specifier.slice(2)))
    }

    const pkg = Object.keys(DIST_OF).find(
      (name) => specifier === name || specifier.startsWith(`${name}/`),
    )
    if (!pkg) return null

    return resolveFile(join(DIST_OF[pkg], specifier.slice(pkg.length + 1)))
  }

  /** Every package specifier reachable from `entries`, with how it got there. */
  const reachableExternals = (entries: string[]) => {
    const visited = new Set<string>()
    const externals = new Map<string, string[]>()

    const walk = (path: string, chain: string[]) => {
      if (visited.has(path)) return
      visited.add(path)

      for (const specifier of importsFrom(path)) {
        const target = resolveSpecifier(specifier, path)

        if (target) {
          walk(target, [...chain, relative(repoRoot, target)])
        } else if (!specifier.startsWith('.') && !externals.has(specifier)) {
          externals.set(specifier, chain)
        }
      }
    }

    for (const entry of entries) {
      const path = resolveFile(join(repoRoot, entry))
      expect(path, `${entry} exists`).not.toBeNull()
      if (path) walk(path, [entry])
    }

    return { externals, visited }
  }

  const offenders = (entries: string[], forbidden: string[]): string[] =>
    [...reachableExternals(entries).externals]
      .filter(([specifier]) =>
        forbidden.some((entry) => matches(specifier, entry)),
      )
      .map(([specifier, chain]) => `${specifier} via ${chain.join(' -> ')}`)

  /** Everything the app reaches, from every entry point it has. */
  const ENTRIES = [
    'apps/web/src/components/language-switcher.tsx',
    'apps/web/src/components/migration-link.tsx',
    'apps/web/src/components/route-messages.tsx',
    // Stage 6. The auth surface reaches deepest into `@vitnode/core` of
    // anything this app renders - the shared login card pulls in `AutoForm`,
    // and with it the whole form and design-system stack. That graph was
    // Next-only until `hooks/use-captcha.ts` stopped importing
    // `@/lib/navigation`, so it is exactly the graph worth walking here.
    'apps/web/src/lib/auth/actions.ts',
    'apps/web/src/lib/auth/redirects.ts',
    'apps/web/src/lib/auth/screens.ts',
    'apps/web/src/lib/middleware-config.ts',
    'apps/web/src/routes/_main/_authenticated.tsx',
    'apps/web/src/routes/login.tsx',
    'apps/web/src/routes/login_.sso.$providerId.tsx',
    // Stage 9. Registration reaches deeper still than the login card: the same
    // `AutoForm` stack plus the captcha widget, the password checklist tooltip
    // and the confirmation screen. Password recovery adds core's shared error
    // screen on top. Both were Next-only until Stage 9 split their views.
    'apps/web/src/lib/auth/password-reset-route.ts',
    'apps/web/src/routes/register.tsx',
    'apps/web/src/routes/login_.reset-password.tsx',
    // Stage 9. The settings subtree, which is the first *nested layout* this app
    // renders and the first place the shared settings frame - the navigation
    // card, the mobile back link, the panel card - is mounted outside Next.js.
    // The devices panel is the one with data, so its graph reaches core's list,
    // its revoke and the confirm dialog behind the revoke button.
    'apps/web/src/components/layout/settings-breadcrumb.tsx',
    'apps/web/src/lib/devices/devices.ts',
    'apps/web/src/lib/settings/panel.ts',
    'apps/web/src/routes/_main/_authenticated/settings.tsx',
    'apps/web/src/routes/_main/_authenticated/settings/devices.tsx',
    'apps/web/src/routes/_main/_authenticated/settings/index.tsx',
    'apps/web/src/routes/_main/_authenticated/settings/overview.tsx',
    'apps/web/src/routes/_main/_authenticated/settings/security.tsx',
    'apps/web/src/server/devices.server.ts',
    // Stage 7. `/files` renders the whole data table - eight columns, the
    // bulk-action bar and both confirm dialogs - which is the deepest this app
    // reaches into the design system after the auth screens. That graph was
    // Next-only until `next/dynamic` inside `ConfirmActionAlertDialog` became
    // `React.lazy`, so it is exactly the graph worth walking here.
    'apps/web/src/lib/files/my-files-route.ts',
    'apps/web/src/lib/files/my-files.ts',
    'apps/web/src/routes/_main/_authenticated/files.tsx',
    'apps/web/src/server/my-files.server.ts',
    'apps/web/src/lib/i18n/client.ts',
    'apps/web/src/lib/i18n/query.ts',
    'apps/web/src/lib/i18n/shared.ts',
    'apps/web/src/lib/search/discover-feed.ts',
    'apps/web/src/lib/search/discover-request.ts',
    'apps/web/src/lib/search/feed.ts',
    'apps/web/src/lib/search/search-request.ts',
    'apps/web/src/router.tsx',
    'apps/web/src/routes/__root.tsx',
    // Stage 8. The main shell, and with it the header and breadcrumb slots the
    // pages under it render inside.
    'apps/web/src/routes/_main.tsx',
    'apps/web/src/routes/_main/discover.tsx',
    'apps/web/src/routes/_main/index.tsx',
    'apps/web/src/routes/_main/search.tsx',
    'apps/web/src/server/search-feed.server.ts',
    'apps/web/src/server/locale.server.ts',
    'apps/web/src/server/messages.server.ts',
    'apps/web/src/start.ts',
    'apps/web/src/vitnode.config.ts',
    'apps/web/src/vitnode.shell.config.ts',
  ]

  it('needs the packages to be built to mean anything', () => {
    // A missing `dist` makes every assertion below vacuous: nothing resolves, so
    // nothing is walked. `turbo` builds the packages before this app's tests.
    expect(
      existsSync(join(DIST_OF['@vitnode/core'], 'views/layouts/providers.js')),
      'run `turbo build:plugins` first',
    ).toBe(true)
  })

  it('walks into the packages rather than stopping at the app', () => {
    const { visited } = reachableExternals(ENTRIES)

    expect(
      [...visited].filter((path) => path.includes('packages/vitnode/dist'))
        .length,
    ).toBeGreaterThan(5)
  })

  it('finds Next.js in a plugin frontend entry, which is why one is not imported', () => {
    // The control, and the reason `vitnode.config.ts` registers plugins by id
    // and messages instead of calling `blogPlugin()`.
    expect(
      offenders(['plugins/blog/dist/src/config.js'], NEXT_ONLY),
    ).not.toEqual([])
  })

  it('reaches no next/* and no server-only', () => {
    expect(offenders(ENTRIES, NEXT_ONLY)).toEqual([])
  })

  it("reaches none of next-intl's Next-only entries", () => {
    expect(offenders(ENTRIES, NEXT_INTL_RUNTIME)).toEqual([])
  })

  /**
   * `/discover`, on its own.
   *
   * The first VitNode route to render outside Next.js, and the one whose graph
   * is worth stating separately from the app's: it is the route that renders
   * *shared* components, so it is the one that would find out - at runtime, in
   * production - that a piece of the design system still reaches for Next's
   * router or its request scope. It already did once: `HeaderContent` imported
   * `@/lib/navigation`, which is `next-intl/navigation` and `next-intl/server`,
   * and the back link it needed them for is now a prop.
   *
   * Every forbidden entry is asserted one at a time rather than as a set, so a
   * failure names the specifier rather than "something in this list".
   */
  describe('the /discover runtime graph reaches no Next.js', () => {
    const DISCOVER = ['apps/web/src/routes/_main/discover.tsx']

    it('walks into the shared components the route renders', () => {
      // Without this the assertions below would pass on a graph that stopped at
      // the route file - which is exactly the graph that cannot break.
      const reached = [...reachableExternals(DISCOVER).visited]

      expect(reached.some((path) => path.includes('search-feed-content'))).toBe(
        true,
      )
      expect(reached.some((path) => path.includes('header-content'))).toBe(true)
    })

    it.each([
      'next',
      'next/cache',
      'next/server',
      'next-intl/navigation',
      'next-intl/server',
      'server-only',
    ])('never reaches %s', (forbidden) => {
      expect(offenders(DISCOVER, [forbidden])).toEqual([])
    })

    it('takes its translations from use-intl', () => {
      const reached = [...reachableExternals(DISCOVER).externals.keys()]

      expect(reached).toContain('use-intl')
    })

    it("only ever reaches next-intl's framework-free root entry", () => {
      // The root entry is `use-intl` re-exported and resolves fine outside
      // Next.js - `Button`'s client half still imports it for the loading
      // label, and that is allowed by the same rule the app-wide scan uses.
      // What must never appear is a subpath: those reach Next's request scope,
      // its middleware or its build plugin, and none of them resolves here.
      const reached = [...reachableExternals(DISCOVER).externals.keys()]

      expect(reached.filter((one) => one.startsWith('next-intl/'))).toEqual([])
    })

    it('never reaches a locale-aware navigation module', () => {
      // The one that made `HeaderContent` Next-only. `Link` now arrives as a
      // prop, from whichever router the app happens to have.
      const reached = [...reachableExternals(DISCOVER).externals.keys()]

      expect(reached.filter((one) => one.includes('navigation'))).toEqual([])
    })
  })

  /**
   * `/search`, on its own.
   *
   * Stated separately from `/discover` because it renders strictly more of the
   * shared stack: the same feed, plus the controls above it - an input group, a
   * native select, a row of buttons and a debounced callback. That is the design
   * system, and the design system is where a stray `next/dynamic` or
   * `next-intl/navigation` hides. `SearchControls` was Next-only for exactly
   * that reason until the controls became `SearchControlsContent`.
   */
  describe('the /search runtime graph reaches no Next.js', () => {
    const SEARCH = ['apps/web/src/routes/_main/search.tsx']

    it('walks into the shared controls the route renders', () => {
      // Without this the assertions below would pass on a graph that stopped at
      // the route file - which is exactly the graph that cannot break.
      const reached = [...reachableExternals(SEARCH).visited]

      expect(
        reached.some((path) => path.includes('search-controls-content')),
      ).toBe(true)
      expect(reached.some((path) => path.includes('search-feed-content'))).toBe(
        true,
      )
      expect(reached.some((path) => path.includes('input-group'))).toBe(true)
    })

    it('never reaches the Next wrapper the shared controls were split from', () => {
      // `search-controls.tsx` resolves the locale through `next-intl` and takes
      // its link from `@/lib/navigation`. Reaching it from here would mean the
      // route imported the wrapper rather than the shared component.
      const reached = [...reachableExternals(SEARCH).visited]

      expect(
        reached.filter((path) => /search-(controls|feed)\.js$/.test(path)),
      ).toEqual([])
    })

    it.each([
      'next',
      'next/cache',
      'next/dynamic',
      'next/server',
      'next-intl/navigation',
      'next-intl/server',
      'server-only',
    ])('never reaches %s', (forbidden) => {
      expect(offenders(SEARCH, [forbidden])).toEqual([])
    })

    it('takes its translations from use-intl', () => {
      const reached = [...reachableExternals(SEARCH).externals.keys()]

      expect(reached).toContain('use-intl')
    })

    it("only ever reaches next-intl's framework-free root entry", () => {
      const reached = [...reachableExternals(SEARCH).externals.keys()]

      expect(reached.filter((one) => one.startsWith('next-intl/'))).toEqual([])
    })

    it('never reaches a locale-aware navigation module', () => {
      const reached = [...reachableExternals(SEARCH).externals.keys()]

      expect(reached.filter((one) => one.includes('navigation'))).toEqual([])
    })
  })

  /**
   * `/files`, on its own.
   *
   * The deepest graph this app has after the auth screens, and the one with the
   * most ways to go wrong: the data table, its four URL controls, the bulk
   * action bar, the row menu and both confirm dialogs. Three separate imports
   * kept it Next-only until Stage 7 - `next/dynamic` inside
   * `ConfirmActionAlertDialog`, `@/lib/navigation` inside four table controls,
   * and a `"use server"` module behind the delete button - and none of the three
   * was visible from the route file.
   */
  describe('the /files runtime graph reaches no Next.js', () => {
    const FILES = ['apps/web/src/routes/_main/_authenticated/files.tsx']

    it('walks into the table and the dialogs the route renders', () => {
      // Without this the assertions below would pass on a graph that stopped at
      // the route file - which is exactly the graph that cannot break.
      const reached = [...reachableExternals(FILES).visited]

      expect(
        reached.some((path) => path.includes('my-files-table-content')),
      ).toBe(true)
      expect(reached.some((path) => path.includes('table/content'))).toBe(true)
      expect(
        reached.some((path) => path.includes('confirm-action-alert-dialog')),
      ).toBe(true)
    })

    it('never reaches the Next wrappers the shared halves were split from', () => {
      // `my-files-table-view` fetches through `next/headers` and imports the
      // server actions; `data-table` mounts `NextDataTableNavigation`. Reaching
      // either would mean the route imported a wrapper rather than the shared
      // component.
      const reached = [...reachableExternals(FILES).visited]

      expect(
        reached.filter((path) =>
          /(my-files-table-view|table\/data-table|navigation-next)\.js$/.test(
            path,
          ),
        ),
      ).toEqual([])
    })

    it("never reaches the core package's delete server action", () => {
      // Importing a `"use server"` module pulls the fetcher, `next/headers` and
      // the whole API module graph in behind it. Both deletes are props.
      //
      // Note this is not a blanket ban on `*.server`: the route legitimately
      // reaches `apps/web/src/server/my-files.server.ts`, which is this app's
      // own SSR transport behind `createIsomorphicFn`. The two conventions share
      // a suffix and nothing else.
      const reached = [...reachableExternals(FILES).visited]

      expect(
        reached.filter((path) => path.includes('delete-action.server')),
      ).toEqual([])
    })

    it.each([
      'next',
      'next/cache',
      'next/dynamic',
      'next/headers',
      'next/navigation',
      'next/server',
      'next-intl/navigation',
      'next-intl/server',
      'server-only',
    ])('never reaches %s', (forbidden) => {
      expect(offenders(FILES, [forbidden])).toEqual([])
    })

    it('never reaches the API the table is authorized by', () => {
      // `my-files-query.ts` imports the files module as a *type* only, so the
      // route literals still infer while Hono, Drizzle and `@/database` stay out
      // of the bundle. A value import here is a server framework in the browser.
      const reached = [...reachableExternals(FILES).externals.keys()]

      expect(reached).not.toContain('drizzle-orm')
      expect(reached.filter((one) => one.startsWith('hono'))).toEqual([])
    })

    it("only ever reaches next-intl's framework-free root entry", () => {
      const reached = [...reachableExternals(FILES).externals.keys()]

      expect(reached.filter((one) => one.startsWith('next-intl/'))).toEqual([])
    })

    it('never reaches a locale-aware navigation module', () => {
      const reached = [...reachableExternals(FILES).externals.keys()]

      expect(reached.filter((one) => one.includes('navigation'))).toEqual([])
    })
  })

  /**
   * Every migrated screen at once: the shared client contract is `use-intl`.
   *
   * The per-route blocks above ban `next-intl`'s *subpaths*, which reach Next's
   * request scope and simply do not resolve here. This bans the root entry too,
   * across everything this app renders, and that is a different bug it is
   * closing.
   *
   * `next-intl`'s root re-exports `use-intl/react`, so a shared component that
   * imports it *does* read the context core's provider supplies - today. It is
   * a coincidence of how one package re-exports another, and it held only
   * because every design-system component that reached for it happened to read
   * `core.global`, which the root provides to every page. A component that read
   * a route's own namespace through a second record would render the root's
   * messages instead: no error, no missing key, just a page in the wrong
   * language below a shell in the right one. That is the failure this asserts
   * away, rather than trusting the re-export to keep pointing where it does.
   *
   * `routes/api/$` is deliberately not in the list. It mounts the Hono API,
   * which renders emails with `createTranslator` from `next-intl`'s root - the
   * framework-free half, on a server, in a graph that renders no React. The
   * boundary here is about what the *browser* and the SSR pass render.
   */
  describe('every migrated screen takes its translations from use-intl', () => {
    /** One entry per route file the router can render, plus the shell slots. */
    const RENDERED = [
      'apps/web/src/routes/__root.tsx',
      'apps/web/src/routes/_main.tsx',
      'apps/web/src/routes/_main/index.tsx',
      'apps/web/src/routes/_main/discover.tsx',
      'apps/web/src/routes/_main/search.tsx',
      'apps/web/src/routes/_main/_authenticated.tsx',
      'apps/web/src/routes/_main/_authenticated/files.tsx',
      'apps/web/src/routes/_main/_authenticated/settings.tsx',
      'apps/web/src/routes/_main/_authenticated/settings/index.tsx',
      'apps/web/src/routes/_main/_authenticated/settings/overview.tsx',
      'apps/web/src/routes/_main/_authenticated/settings/devices.tsx',
      'apps/web/src/routes/_main/_authenticated/settings/security.tsx',
      'apps/web/src/routes/login.tsx',
      'apps/web/src/routes/login_.reset-password.tsx',
      'apps/web/src/routes/login_.sso.$providerId.tsx',
      'apps/web/src/routes/register.tsx',
      'apps/web/src/components/header.tsx',
      'apps/web/src/components/layout/main-breadcrumb.tsx',
      'apps/web/src/components/layout/main-header.tsx',
      'apps/web/src/components/layout/settings-breadcrumb.tsx',
      'apps/web/src/components/layout/user-header.tsx',
      'apps/web/src/components/route-messages.tsx',
    ]

    it('walks into the design system, where the imports it bans live', () => {
      // Without this the assertion below would pass on a graph that stopped at
      // the route files - which is exactly the graph that cannot break. These
      // four are the components that reached for `next-intl` before this stage.
      const reached = [...reachableExternals(RENDERED).visited]

      for (const module of [
        'components/form/auto-form',
        'components/table/content',
        'components/ui/button-client',
        'components/confirm-action/confirm-action-alert-dialog',
      ]) {
        expect(
          reached.some((path) => path.includes(module)),
          module,
        ).toBe(true)
      }
    })

    it('reaches use-intl', () => {
      expect([...reachableExternals(RENDERED).externals.keys()]).toContain(
        'use-intl',
      )
    })

    it('never reaches next-intl, root entry included', () => {
      expect(offenders(RENDERED, ['next-intl'])).toEqual([])
    })
  })
})

/**
 * The shared / client / server split inside the locale layer.
 *
 * The rules that decide which language a URL is in have to be usable from four
 * places that cannot import each other's runtimes - the server middleware, the
 * router rewrite, the browser, and a plain test. That only holds while the
 * shared half stays framework-free, and "framework-free" is not something a
 * reviewer can be relied on to notice slipping.
 */
describe('the locale layer keeps its halves apart', () => {
  const appSrc = join(repoRoot, 'apps/web/src')
  const read = (file: string) => readFileSync(join(appSrc, file), 'utf8')

  it('has the three modules it claims to', () => {
    for (const file of [
      'lib/i18n/shared.ts',
      'lib/i18n/client.ts',
      'server/locale.server.ts',
    ]) {
      expect(existsSync(join(appSrc, file)), file).toBe(true)
    }
  })

  it('keeps the shared half free of every framework', () => {
    const shared = [join(appSrc, 'lib/i18n/shared.ts')]

    expect(offendersIn(shared, TANSTACK_ONLY)).toEqual([])
    expect(offendersIn(shared, NEXT_ONLY)).toEqual([])
    expect(offendersIn(shared, ['next-intl', 'use-intl'])).toEqual([])
  })

  it('keeps the shared half free of the DOM and of request handling', () => {
    // Comments stripped: this file is largely prose about `Request`s and
    // cookies, and the point is that none of it is code.
    const code = read('lib/i18n/shared.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')

    for (const global of DOM_ONLY_GLOBALS) {
      expect(code, `shared/${global}`).not.toContain(global)
    }
    expect(code).not.toContain('Request')
    expect(code).not.toContain('cookie')
  })

  it('keeps request and cookie handling on the server side', () => {
    // `locale.server.ts` is the only module that takes a `Request`, and the
    // `server-only` import at the top of it is what turns "somebody imported
    // this from a component" into a build error.
    expect(read('server/locale.server.ts')).toContain(
      "import '@tanstack/react-start/server-only'",
    )
    expect(read('lib/i18n/client.ts')).not.toContain('handleLocaleRequest')
  })

  it('leaves the locale rules in core, not copied into the app', () => {
    // The single place `/en` becomes `/`, in one direction or the other.
    const copies = filesUnder(appSrc).filter(
      (path) =>
        !path.includes('/tests/') &&
        /\$\{locale\}\/|'\/' \+ locale|`\/\$\{/.test(
          readFileSync(path, 'utf8'),
        ),
    )

    expect(copies.map((path) => relative(repoRoot, path))).toEqual([])
  })
})
