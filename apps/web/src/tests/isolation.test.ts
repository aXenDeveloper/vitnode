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
 * type` lines in it. `@vitnode/core/tanstack/auth/server` names the API's users
 * module purely so the route literals infer; following it would report Hono,
 * Drizzle and the whole API tree as things a login screen loads.
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
  it('finds the Next.js imports in the specimen that carries them', () => {
    // Stage 17 deleted `packages/vitnode/src/content/next`, which used to be
    // this control. There is no Next-importing production code left to point
    // at - which is the goal, and which would have quietly turned every
    // assertion below into a tautology.
    //
    // `test-fixtures/next-specimen/` replaces it: a deliberate Next.js import
    // graph that exists to be scanned and for no other reason. It lives outside
    // `src` and outside `tsconfig.json`'s `include`, so `next` never has to be
    // installed for it to sit there, and it cannot rot the way a real module
    // can - production code moving on cannot take its specimen with it.
    expect(
      offendersIn(
        filesUnder(
          join(repoRoot, 'packages/vitnode/test-fixtures/next-specimen'),
        ),
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

/**
 * There was a third party to this rule until Stage 17: `apps/docs`, the Next.js
 * application, which this suite held to the mirror-image promise of never
 * importing TanStack Start. It is deleted, so the promise has no subject and the
 * `describe` block that stated it is gone rather than adjusted - a scan over a
 * directory that does not exist passes by finding nothing, which is the shape of
 * assertion worth deleting outright.
 *
 * What the two-way rule protected is still protected from the other side:
 * `package-boundary.test.ts` holds `@vitnode/core` to reaching no TanStack
 * runtime from anything outside its `tanstack/` namespace, which is the half
 * that matters to somebody installing VitNode into a Next.js app of their own.
 */
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
    // under `vite dev`; Stage 10 moved that whole arrangement into the package,
    // and `lib/i18n/runtime.ts` now hands this app's own `use-intl` record over
    // as `configureIntl({ hostIntlProvider })` for `RouteMessages` to mount. See
    // `packages/vitnode/src/tanstack/i18n/provider-records.test.ts`, which is
    // where the three-provider rule is pinned.
    //
    // Runtime files only: `intl-runtime.test.ts` asserts *about* these imports,
    // so it necessarily contains the specifiers the scanner is looking for.
    const runtime = webFiles().filter(
      (path) => !path.includes(`${sep}tests${sep}`),
    )

    expect(offendersIn(runtime, ['next-intl'])).toEqual([])
  })

  it('depends on use-intl directly', () => {
    // Two copies of `use-intl` means two React contexts: the provider this app
    // mounts and the `useTranslations` inside a core component would each see
    // their own, and every shared string would throw `MISSING_MESSAGE`.
    //
    // This used to assert the version matched `next-intl`'s, because next-intl
    // bundled its own copy of use-intl and that was the second copy. With
    // next-intl gone there is only one path to it, so what is left to state is
    // that this app declares it directly rather than borrowing @vitnode/core's
    // - a transitive copy is the other way the second context appears.
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, 'apps/web/package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> }

    expect(manifest.dependencies?.['use-intl']).toBeDefined()
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
    'apps/web/src/components/main-header.tsx',
    // Stage 6. The auth surface reaches deepest into `@vitnode/core` of
    // anything this app renders - the shared login card pulls in `AutoForm`,
    // and with it the whole form and design-system stack. That graph was
    // Next-only until `hooks/use-captcha.ts` stopped importing
    // `@/lib/navigation`, so it is exactly the graph worth walking here.
    //
    // Stage 10 moved the auth implementation itself into
    // `@vitnode/core/tanstack/auth`, which is why there are no `lib/auth/*`
    // entries left: the routes below reach all of it - the actions, the screen
    // mappings, the deployment configuration - through the package, and walking
    // from a route is what proves that graph is still Next-free.
    'apps/web/src/lib/auth.ts',
    'packages/vitnode/dist/src/tanstack/routes/root/auth.js',
    'packages/vitnode/dist/src/tanstack/routes/root/sso.js',
    // Stage 9. Registration reaches deeper still than the login card: the same
    // `AutoForm` stack plus the captcha widget, the password checklist tooltip
    // and the confirmation screen. Password recovery adds core's shared error
    // screen on top. Both were Next-only until Stage 9 split their views.
    // Stage 9. The settings subtree, which is the first *nested layout* this app
    // renders and the first place the shared settings frame - the navigation
    // card, the mobile back link, the panel card - is mounted outside Next.js.
    // The devices panel is the one with data, so its graph reaches core's list,
    // its revoke and the confirm dialog behind the revoke button.
    //
    // They are `@vitnode/core`'s own code-based routes now, mounted by
    // `withCoreMainRoutes`, so the entry is the module that declares them rather
    // than a file in this application. The walk is the same walk and reaches
    // more: the whole subtree, its guard and its breadcrumb, from one entry.
    'packages/vitnode/dist/src/tanstack/routes/main/settings.js',
    // Stage 7. `/files` renders the whole data table - eight columns, the
    // bulk-action bar and both confirm dialogs - which is the deepest this app
    // reaches into the design system after the auth screens. That graph was
    // Next-only until `next/dynamic` inside `ConfirmActionAlertDialog` became
    // `React.lazy`, so it is exactly the graph worth walking here.
    //
    // Stage 10 moved the query definition, the URL contract and the SSR
    // transport into `@vitnode/core/tanstack/files`, so the route file is the
    // only entry left - and walking it still reaches all three, because the walk
    // follows the package's own `dist` out of the barrel it imports.
    'packages/vitnode/dist/src/tanstack/routes/main/files.js',
    // The signed-in guard the two above sit behind, which moved with them.
    'packages/vitnode/dist/src/tanstack/routes/main/index.js',
    // Stage 10. The i18n runtime moved into `@vitnode/core/tanstack/i18n`;
    // what is left here is the app's language list and the one server function
    // a package may not declare. Walking it still reaches the whole runtime,
    // because the walk follows the package's `dist` out of the barrel.
    'apps/web/src/lib/i18n/runtime.ts',
    'apps/web/src/lib/i18n/shared.ts',
    'apps/web/src/router.tsx',
    'apps/web/src/routes/__root.tsx',
    // Stage 8. The main shell, and with it the header and breadcrumb slots the
    // pages under it render inside.
    'apps/web/src/routes/_main.tsx',
    'apps/web/src/routes/_main/index.tsx',
    'packages/vitnode/dist/src/tanstack/routes/main/discovery.js',
    'apps/web/src/server/messages.server.ts',
    'apps/web/src/start.ts',
    'apps/web/src/vitnode.config.ts',
    'apps/web/src/vitnode.shell.config.ts',
    // Stage 12. The AdminCP: the guard and shell, the sign-in screen, and the
    // two server functions the panel's session and palette run on.
    //
    // The screens themselves are **derived** below rather than listed. Every
    // other entry in this array was chosen by hand for reaching deepest, and
    // that is fine for a surface that stopped growing - but `_admin/` gains a
    // file every time a screen migrates, and a hand-picked list is a list
    // somebody has to remember. It was exactly that kind of list, in
    // `screen-boundaries.test.ts`, that let the roles screen ship reaching
    // `next-intl`: the note excluding it said "whoever migrates it will meet
    // it", the screen was migrated, and the exclusion quietly became cover.
    'apps/web/src/components/admin-shell.tsx',
    'apps/web/src/lib/admin-auth.ts',
    'apps/web/src/lib/admin-nav.ts',
    'apps/web/src/lib/admin-search.ts',
    'packages/vitnode/dist/src/tanstack/routes/root/admin-sign-in.js',
    'apps/web/src/routes/_admin.tsx',
    // Stage 16. The documentation, which is the first thing this application
    // renders out of a third-party UI library rather than out of
    // `@vitnode/core` - and Fumadocs ships a Next.js integration in the same
    // package as the framework-neutral one. `fumadocs-ui/provider/next` and
    // `fumadocs-mdx/next` both resolve here and both would work in a type
    // checker; only the runtime would notice.
    'apps/web/src/routes/_docs.tsx',
    'apps/web/src/routes/_docs/docs.$.tsx',
    'apps/web/src/routes/_docs/docs.index.tsx',
    // Derived, not hand-picked - and derived from where the screens now live.
    //
    // They were `apps/web/src/routes/_admin/**` until `withCoreAdminRoutes`
    // existed; they are `@vitnode/core`'s code-based routes now, and one anchor
    // file is left in the app because a pathless layout with no file children is
    // dropped from the generated tree. Both directories are walked, so a screen
    // gaining an import is caught wherever it is declared and nobody has to
    // remember to add it here.
    ...[
      ...filesUnder(join(repoRoot, 'apps/web/src/routes/_admin')),
      // The built files, not the sources: the walker resolves a package's `@/`
      // imports out of its `dist`, which is also what a bundler loads - walking
      // the source would stop at the first alias and quietly assert nothing.
      ...filesUnder(
        join(repoRoot, 'packages/vitnode/dist/src/tanstack/routes/admin'),
      ).filter((path) => path.endsWith('.js')),
      ...filesUnder(
        join(repoRoot, 'packages/vitnode/dist/src/tanstack/routes/main'),
      ).filter((path) => path.endsWith('.js')),
    ]
      .map((path) => relative(repoRoot, path))
      .sort(),
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

  it('finds Next.js where Next.js really is', () => {
    // The control: proof the walk detects what it claims to, so
    // "reaches no next/*" below cannot pass because nothing was walked.
    //
    // Stage 12 used `plugins/blog/dist/src/config.js` for this, because a
    // plugin's frontend registration was Next-bound. Stage 13 made that false,
    // so it moved to the Content Engine's server-side fetch - and Stage 17
    // deleted that too, along with every other Next-importing module in the
    // repository.
    //
    // So the control is now a fixture rather than a real module:
    // `test-fixtures/next-specimen/` is a deliberate Next.js import graph, kept
    // outside `src` and outside tsconfig's `include`. It is two files deep on
    // purpose - a one-file specimen would still satisfy a walker that read the
    // entry and never followed an edge, and "the offending import is three
    // files away from the one being written" is the whole reason this walk
    // exists.
    expect(
      offenders(
        ['packages/vitnode/test-fixtures/next-specimen/entry.ts'],
        [...NEXT_ONLY],
      ),
    ).not.toEqual([])
  })

  /**
   * Stage 13. A plugin's whole frontend registration is now Next-free.
   *
   * This is the inversion of the Stage 12 control above, and it is what the
   * generated content registry rests on: `config.js` reaches
   * `admin/content.js`, which reaches every override the blog ships - the Tiptap
   * editor field, the colour field, the colour cell and the article form layout
   * - and none of that graph names Next any more. The editor's toolbar moved to
   * `use-intl`, the field's lazy boundary moved to `React.lazy`, and the form
   * layout's two links became an injected component.
   *
   * Asserted on `config.js` rather than on `admin/content.js` because it is the
   * stronger claim: `config.js` is the whole plugin - the registration, the
   * overrides and the messages - so nothing a plugin ships to a frontend is
   * Next-bound any more.
   *
   * `vitnode.config.ts` still registers plugins by id and messages rather than
   * calling `blogPlugin()`, and that is now a scope decision rather than a
   * compatibility one - see the note there. This is what makes it a decision:
   * the option exists, and it is declined.
   */
  it('finds no Next.js in a plugin frontend registration', () => {
    expect(
      offenders(
        [
          'plugins/blog/dist/src/config.js',
          'plugins/example/dist/src/config.js',
        ],
        [...NEXT_ONLY, ...NEXT_INTL_RUNTIME],
      ),
    ).toEqual([])
  })

  it('reaches no next/* and no server-only', () => {
    expect(offenders(ENTRIES, NEXT_ONLY)).toEqual([])
  })

  it("reaches none of next-intl's Next-only entries", () => {
    expect(offenders(ENTRIES, NEXT_INTL_RUNTIME)).toEqual([])
  })

  /**
   * The *rendered* graph reaches no `next-intl` at all - not even its bare
   * client entry, which the list above deliberately omits.
   *
   * ## Why the bare specifier is worth forbidding even though it works
   *
   * `next-intl`'s root entry is not Next-only at runtime: its client
   * `useTranslations` is a two-line wrapper over `use-intl`'s, resolving the
   * same module and therefore the same React context, and it re-exports
   * `createTranslator` from `use-intl/core` verbatim. That is exactly why
   * `components/ui/color-picker.tsx` reached it for a whole stage without
   * anything failing - and why the roles screen shipped with it in its graph.
   *
   * What it costs is not a render, it is the boundary: a component in the shared
   * tree that reads `next-intl` is one a framework-neutral package cannot claim
   * to be framework-neutral about, and every such reach is invisible because it
   * works. So the rule for anything React renders in this application is
   * `use-intl`, directly.
   *
   * ## Why the API mount is not in this walk
   *
   * `routes/api/$.ts` mounts Hono, whose graph reaches core's server-side
   * `createTranslator` calls - the locale negotiator and the reset-password
   * email - and those still read `next-intl` **on purpose**.
   * `packages/vitnode/src/lib/i18n/rsc-boundaries.test.ts` requires it: those
   * same modules are rendered on the server by `apps/docs`, where reading
   * `use-intl` is the mistake, and it holds the scar from `ContentDataTable` to
   * prove the cost. Two halves, two rules, and this app is the one that has to
   * hold both - so this walks the half the rule applies to rather than
   * pretending there is one rule.
   *
   * It follows that `apps/web` still legitimately depends on `next-intl`, and
   * the assertion above about `apps/web/src` naming it is what keeps that
   * dependency purely transitive.
   */
  const RENDERED_ENTRIES = ENTRIES.filter(
    (entry) => !entry.startsWith('apps/web/src/routes/api/'),
  ).concat('apps/web/src/routes/_admin.tsx')

  it('renders nothing that reaches next-intl', () => {
    // `router.tsx` pulls the generated route tree, which pulls the API mount, so
    // the walk is seeded from the shells and screens rather than from the router.
    const rendered = RENDERED_ENTRIES.filter(
      (entry) => !entry.endsWith('router.tsx'),
    )

    expect(offenders(rendered, ['next-intl'])).toEqual([])
  })

  it('still reaches the AdminCP shell from that walk, so it is not vacuous', () => {
    const reached = [...reachableExternals(RENDERED_ENTRIES).visited]

    expect(reached.some((path) => path.includes('tanstack/admin/shell'))).toBe(
      true,
    )
    expect(
      reached.some((path) => path.includes('ui/color-picker')),
      'the roles screen reaches the colour picker that used to read next-intl',
    ).toBe(true)
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
    const DISCOVER = [
      'packages/vitnode/dist/src/tanstack/routes/main/discovery.js',
    ]

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
   * The front page, on its own.
   *
   * Stage 15. Stated separately because it is the one route whose graph is
   * mostly *this application's own code* - the hero, the marquee, the AdminCP
   * section, the beam - rather than `@vitnode/core`'s, and because of what the
   * page it replaced was made of. The Next.js homepage rendered
   * `fumadocs-core/link` for its "Get Started" button, `next/image` for the
   * screenshot and `@vitnode/core/lib/navigation` - next-intl's navigation -
   * for every logo in the marquee and every circle in the beam. Three separate
   * framework couplings on one page, none of which can exist here.
   *
   * `fumadocs-core` is on the forbidden list even though this app now serves
   * `/docs`: it is a Next.js library, and a `fumadocs-core/link` reaching the
   * front page would compile, bundle and only fail once somebody clicked it.
   * The documentation's own graph is walked separately, below.
   *
   * The walk follows dynamic `import()` as well as static imports, so the beam's
   * `React.lazy` chunk is in this graph - lazy is a bundling decision, not an
   * exemption from the boundary.
   */
  describe('the front page runtime graph reaches no Next.js', () => {
    const HOME = ['apps/web/src/routes/_main/index.tsx']

    it('walks into the page the route renders', () => {
      // Without this the assertions below would pass on a graph that stopped at
      // the route file - which is exactly the graph that cannot break.
      const reached = [...reachableExternals(HOME).visited]

      expect(
        reached.some((path) => path.includes('site/home/home-content')),
      ).toBe(true)
      expect(
        reached.some((path) => path.includes('site/home/sections/hero')),
        'the hero, which carries the Get Started link',
      ).toBe(true)
      expect(
        reached.some((path) => path.includes('animated-beam-home')),
        'the lazily imported beam',
      ).toBe(true)
    })

    it.each([
      'next',
      'next/image',
      'next/link',
      'next/navigation',
      'next-intl/navigation',
      'next-intl/server',
      'fumadocs-core',
      'fumadocs-ui',
      'server-only',
    ])('never reaches %s', (forbidden) => {
      expect(offenders(HOME, [forbidden])).toEqual([])
    })

    it('never reaches a locale-aware navigation module', () => {
      // What the marquee and the beam both used to import. Every internal link
      // on the page is an injected component now.
      const reached = [...reachableExternals(HOME).externals.keys()]

      expect(reached.filter((one) => one.includes('navigation'))).toEqual([])
    })

    /**
     * Stage 14's invariant, restated for the route it was measured on.
     *
     * The front page is marketing copy, and a barrel import that reached the
     * AdminCP's shell, one of its screens, the Content Engine or Tiptap would
     * put all of it in front of every first-time visitor. That is not
     * hypothetical: Stage 14 found the users table, the roles table, the
     * dashboard grid and `@dnd-kit` in the chunk that renders this page,
     * because one namespace exported its loader and its screen together.
     *
     * ## What this page *does* legitimately reach, and why it is named
     *
     * Four AdminCP modules are in the graph, via `#/lib/navigation` ->
     * `@vitnode/core/tanstack/auth` -> the auth
     * barrel -> its actions: `tanstack/admin/state.js` and `queries.js`, and
     * the two query-key leaves they read, `views/admin/table/query.js` and
     * `views/admin/layouts/search/search-users.js`. Together they are under
     * 2.5 kB of query keys, paths and permission predicates - the *state* half
     * of exactly the split Stage 14 made, deliberately importable without the
     * screen it belongs to. Reaching them is the split working.
     *
     * So the rule is not "no admin module": a path-prefix ban would fail on the
     * design rather than on a regression, and a byte budget would fail on a
     * dependency bump. It is **no admin module that renders** - nothing in that
     * subtree may reach the JSX runtime, which is what separates a query key
     * from a users table, and is the exact edge Stage 14's regression crossed.
     */
    it('does not drag the AdminCP screens or the Content Engine onto it', () => {
      const ADMIN_OR_CONTENT =
        /tanstack\/admin\/|dist\/src\/views\/admin\/|dist\/src\/content\//
      const reached = [...reachableExternals(HOME).visited]

      const rendering = reached
        .filter((path) => ADMIN_OR_CONTENT.test(path))
        .filter((path) =>
          /react\/jsx-(?:dev-)?runtime/.test(readFileSync(path, 'utf8')),
        )
        .map((path) => relative(repoRoot, path))

      expect(rendering).toEqual([])
      // The editor and the drag-and-drop stack, which only a screen pulls in.
      expect(offenders(HOME, ['@tiptap/react', '@dnd-kit/core'])).toEqual([])
    })
  })

  /**
   * The documentation, on its own.
   *
   * Stage 16. Stated separately from every other route because the risk is a
   * different one: this graph is mostly *Fumadocs*, and Fumadocs ships its
   * Next.js integration in the same packages as its framework-neutral core.
   * `fumadocs-ui/provider/next`, `fumadocs-mdx/next` and `fumadocs-core/framework/next`
   * all resolve from here, all type-check, and each of them would drag `next`
   * into a Next-free build the moment a page rendered.
   *
   * The walk follows dynamic `import()` as well as static imports, which matters
   * here more than anywhere else: the page route reaches its MDX renderer, the
   * source loader and the search index through `await import()`, and being lazy
   * is a bundling decision rather than an exemption from the boundary.
   */
  describe('the documentation runtime graph reaches no Next.js', () => {
    const DOCS = [
      'apps/web/src/routes/_docs.tsx',
      'apps/web/src/routes/_docs/docs.$.tsx',
      'apps/web/src/routes/docs.search.ts',
      'apps/web/src/routes/llms-full[.]txt.ts',
    ]

    it('walks into the documentation this application renders', () => {
      // Without this the assertions below would pass on a graph that stopped at
      // the route files - which is exactly the graph that cannot break.
      const reached = [...reachableExternals(DOCS).visited]

      expect(reached.some((path) => path.includes('docs/shell-content'))).toBe(
        true,
      )
      expect(reached.some((path) => path.includes('docs/source.server'))).toBe(
        true,
      )
      expect(
        reached.some((path) => path.includes('docs/client-loader')),
        'the lazily imported MDX renderer',
      ).toBe(true)
    })

    it('really is a Fumadocs graph, so the bans below mean something', () => {
      const reached = [...reachableExternals(DOCS).externals.keys()]

      expect(reached.some((one) => one.startsWith('fumadocs-'))).toBe(true)
    })

    it.each([
      'next',
      'next/cache',
      'next/dynamic',
      'next/headers',
      'next/image',
      'next/link',
      'next/navigation',
      'next/server',
      'next-intl/navigation',
      'next-intl/server',
      'server-only',
    ])('never reaches %s', (forbidden) => {
      expect(offenders(DOCS, [forbidden])).toEqual([])
    })

    it("never reaches Fumadocs' Next.js integrations", () => {
      const reached = [...reachableExternals(DOCS).externals.keys()]

      // Assembled rather than written out, so the scan below cannot match this
      // file's own text if somebody points it at the test directory.
      const nextEntries = ['provider', 'framework'].flatMap((part) => [
        `fumadocs-ui/${part}/next`,
        `fumadocs-core/${part}/next`,
      ])

      expect(
        reached.filter(
          (one) => nextEntries.includes(one) || one === 'fumadocs-mdx/next',
        ),
      ).toEqual([])
    })

    it('takes the Fumadocs provider from the TanStack entry', () => {
      const reached = [...reachableExternals(DOCS).externals.keys()]

      expect(reached).toContain('fumadocs-ui/provider/tanstack')
    })
  })

  /**
   * Every live component the documentation renders, on its own.
   *
   * `<Preview name="button" />` mounts `src/docs/examples/button.tsx` - 37 of
   * them, reached through an `import.meta.glob`, which is not a static import
   * and is therefore invisible to the documentation walk above. So they are
   * walked as entries in their own right, because *every one of them* is
   * reachable from a documentation page and each renders a piece of the shared
   * design system straight out of `@vitnode/core`.
   *
   * That is exactly how `AutoFormRoles` was caught: it read `next-intl` and
   * defaulted its role search to a `"use server"` action, so `/docs/ui/roles`
   * threw `This module cannot be imported from a Client Component module`
   * during SSR - a runtime failure, on one page, that no type check and no
   * per-route walk could see. The examples are the widest surface this
   * application has onto the design system, which makes them the right place to
   * hold the line.
   */
  describe('the documentation live examples reach no Next.js', () => {
    const EXAMPLES = filesUnder(join(repoRoot, 'apps/web/src/docs/examples'))
      .map((path) => relative(repoRoot, path))
      .sort()

    it('has examples to check, and a lot of them', () => {
      expect(EXAMPLES.length).toBeGreaterThan(30)
    })

    it('walks into the design system each one renders', () => {
      // Without this the assertions below would pass on a graph that stopped at
      // the example files - which is exactly the graph that cannot break.
      const reached = [...reachableExternals(EXAMPLES).visited]

      expect(
        reached.some((path) => path.includes('components/form/auto-form')),
      ).toBe(true)
      expect(
        reached.some((path) => path.includes('form/fields/input-roles')),
      ).toBe(true)
      expect(
        reached.some((path) => path.includes('components/table/content')),
      ).toBe(true)
    })

    it.each([
      'next',
      'next/cache',
      'next/dynamic',
      'next/headers',
      'next/navigation',
      'next/server',
      'next-intl',
      'server-only',
    ])('never reaches %s', (forbidden) => {
      expect(offenders(EXAMPLES, [forbidden])).toEqual([])
    })

    it('never reaches a Next.js server action or its wrappers', () => {
      // The `"use server"` modules and the `*-next.tsx` adapters that inject
      // them. An example importing one compiles, bundles, and throws on render.
      const reached = [...reachableExternals(EXAMPLES).visited]

      expect(
        reached.filter((path) => /\.action\.server\.js$|-next\.js$/.test(path)),
      ).toEqual([])
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
    const SEARCH = [
      'packages/vitnode/dist/src/tanstack/routes/main/discovery.js',
    ]

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
    const FILES = ['packages/vitnode/dist/src/tanstack/routes/main/files.js']

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
      // reaches `@vitnode/core/tanstack/files/server`, the SSR transport behind
      // `createIsomorphicFn`. The two conventions share a suffix and nothing
      // else.
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
      // The public and signed-in screens, which are `@vitnode/core`'s own
      // code-based routes - one entry per module that declares them rather than
      // one per file in this application.
      'packages/vitnode/dist/src/tanstack/routes/main/discovery.js',
      'packages/vitnode/dist/src/tanstack/routes/main/files.js',
      'packages/vitnode/dist/src/tanstack/routes/main/settings.js',
      'packages/vitnode/dist/src/tanstack/routes/main/index.js',
      'packages/vitnode/dist/src/tanstack/routes/root/auth.js',
      'packages/vitnode/dist/src/tanstack/routes/root/sso.js',
      'apps/web/src/components/main-header.tsx',
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
 * The client / server split inside the locale layer.
 *
 * The rules that decide which language a URL is in have to be usable from four
 * places that cannot import each other's runtimes - the server middleware, the
 * router rewrite, the browser, and a plain test. Stage 10 moved the layer into
 * `@vitnode/core/tanstack/i18n`, so the split is now a property of the package's
 * two barrels: `index.ts` is imported by route components and is therefore in
 * every browser bundle, and `server.ts` must never be.
 */
describe('the locale layer keeps its halves apart', () => {
  const appSrc = join(repoRoot, 'apps/web/src')
  const layer = join(repoRoot, 'packages/vitnode/src/tanstack/i18n')
  const read = (file: string) => readFileSync(join(appSrc, file), 'utf8')
  const readLayer = (file: string) => readFileSync(join(layer, file), 'utf8')

  it('has the modules it claims to', () => {
    for (const file of ['index.ts', 'server.ts', 'request.ts', 'runtime.ts']) {
      expect(existsSync(join(layer, file)), file).toBe(true)
    }
    // What this app kept: its language list, and the server function a package
    // may not declare.
    expect(existsSync(join(appSrc, 'lib/i18n/runtime.ts'))).toBe(true)
  })

  it('keeps the app half free of every framework but the compiler seam', () => {
    const shared = [join(appSrc, 'lib/i18n/shared.ts')]

    expect(offendersIn(shared, TANSTACK_ONLY)).toEqual([])
    expect(offendersIn(shared, NEXT_ONLY)).toEqual([])
    expect(offendersIn(shared, ['next-intl', 'use-intl'])).toEqual([])
  })

  it('keeps the app half free of the DOM and of request handling', () => {
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

  it('keeps request and cookie handling behind the server barrel', () => {
    // `request.ts` is the only module that takes a `Request`, and the
    // `server-only` import at the top of it is what turns "somebody imported
    // this from a component" into a build error.
    expect(readLayer('request.ts')).toContain(
      'import "@tanstack/react-start/server-only"',
    )
    expect(readLayer('server.ts')).toContain(
      'import "@tanstack/react-start/server-only"',
    )
    // The client-safe barrel is in every browser bundle that renders a route.
    expect(readLayer('index.ts')).not.toContain('handleLocaleRequest')
    expect(readLayer('index.ts')).not.toContain('./messages')
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

/**
 * The AdminCP navigation projection, as an import boundary.
 *
 * The sidebar has to name every plugin the installation configured, and the
 * obvious way to do that - read `vitnode.config.ts` - is the one thing this
 * application cannot do: those registrations carry each content type's editing
 * screens, which reach core's form stack and from there `next/dynamic`. So a
 * plugin ships a second, browser-safe module (`admin/nav`) with the ids, hrefs,
 * permissions, icons and content type definitions in it, and the build writes
 * one literal import per configured plugin into `src/admin-nav.gen.ts`.
 *
 * What is asserted here is that the split is real rather than intended: the
 * navigation graph reaches each plugin's nav module and *not* its `config`.
 * Without the second half this test would pass on a projection that had quietly
 * started importing the whole plugin - which would not fail anything else until
 * a production build tried to bundle Tiptap into a TanStack Start app.
 */
describe('the admin navigation projection stays out of the plugin runtime', () => {
  const NAV_ENTRY = 'apps/web/src/lib/admin-nav.ts'

  const walked = () => {
    const visited = new Set<string>()
    const walk = (path: string) => {
      if (visited.has(path)) return
      visited.add(path)

      for (const specifier of importsFrom(path)) {
        const target = resolveNavSpecifier(specifier, path)
        if (target) walk(target)
      }
    }

    const entry = resolveNavFile(join(repoRoot, NAV_ENTRY))
    expect(entry, `${NAV_ENTRY} exists`).not.toBeNull()
    if (entry) walk(entry)

    return [...visited].map((path) => relative(repoRoot, path))
  }

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

  const resolveNavFile = (base: string): null | string => {
    for (const suffix of CANDIDATES) {
      const path = `${base}${suffix}`
      if (existsSync(path) && statSync(path).isFile()) return path
    }

    return null
  }

  const resolveNavSpecifier = (
    specifier: string,
    importer: string,
  ): null | string => {
    if (specifier.startsWith('.')) {
      return resolveNavFile(resolve(dirname(importer), specifier))
    }
    if (specifier.startsWith('#/')) {
      return resolveNavFile(join(appSrc, specifier.slice(2)))
    }

    const pkg = Object.keys(DIST_OF).find(
      (name) => specifier === name || specifier.startsWith(`${name}/`),
    )
    if (!pkg) return null

    return resolveNavFile(join(DIST_OF[pkg], specifier.slice(pkg.length + 1)))
  }

  it('reaches every configured plugin&apos;s nav module', () => {
    const files = walked()

    expect(files).toContain('plugins/blog/dist/src/admin/nav.js')
    expect(files).toContain('plugins/example/dist/src/admin/nav.js')
  })

  it('never reaches a plugin&apos;s frontend registration', () => {
    const files = walked()

    expect(files).not.toContain('plugins/blog/dist/src/config.js')
    expect(files).not.toContain('plugins/example/dist/src/config.js')
  })

  /**
   * Nor any of a plugin's own views. Core's admin components are legitimately in
   * this graph - `lib/admin-nav.ts` imports `adminNavBundle` from the same
   * barrel the shell comes from - but a *plugin's* screens are exactly what the
   * projection exists to leave behind: the Tiptap field, the form layout, the
   * colour cell.
   */
  it('never reaches a plugin&apos;s own screens', () => {
    expect(
      walked().filter((path) =>
        /^plugins\/[^/]+\/dist\/src\/views\//.test(path),
      ),
    ).toEqual([])
  })
})
