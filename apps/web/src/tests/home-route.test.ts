import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { withoutComments } from './source'

/**
 * The front page, and the boundaries Stage 15 drew around it.
 *
 * Static and type-level only, by the migration testing policy: what this file
 * asks is which module a route points at, which specifiers a graph names, which
 * href a button carries and which line a stylesheet has - all of which are
 * answerable by reading the source, and none of which need a DOM. What the page
 * *looks* like is not asserted anywhere, on purpose; a snapshot of marketing
 * markup fails on every copy edit and catches nothing.
 *
 * The pieces that are checked elsewhere, so that this file does not restate
 * them: `shell-config.test.ts` runs the route's `head` and reads the tags back,
 * `locale-ssr.test.ts` renders `/` and `/pl` through the real request path,
 * `plugin-routes.test.ts` asks the route tree who owns `/docs/dev`,
 * `eager-graph.test.ts` holds every route file to the rule that nothing rendered
 * is named before React runs, and `isolation.test.ts` walks the whole built
 * graph this route reaches looking for Next.js.
 */
const here = dirname(fileURLToPath(import.meta.url))
const appSrc = resolve(here, '..')
const repoRoot = resolve(appSrc, '../../..')
const siteDir = join(appSrc, 'site')

const SKIP_DIRECTORIES = ['.output', '.tanstack', 'dist', 'node_modules']

const filesUnder = (directory: string): string[] => {
  if (!existsSync(directory)) return []

  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)

    if (statSync(path).isDirectory()) {
      return SKIP_DIRECTORIES.includes(name) ? [] : filesUnder(path)
    }

    return /\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [path] : []
  })
}

const read = (path: string) => readFileSync(path, 'utf8')
const code = (path: string) => withoutComments(path)

const ROUTE = join(appSrc, 'routes/_main/index.tsx')
const HOME_CONTENT = join(siteDir, 'home/home-content.tsx')
const HERO = join(siteDir, 'home/sections/hero.tsx')
const HEADER = join(appSrc, 'components/main-header.tsx')
const STYLES = join(appSrc, 'styles.css')
const LOGO = join(repoRoot, 'packages/vitnode/src/components/logo-vitnode.tsx')
const CORE_HEADER = join(
  repoRoot,
  'packages/vitnode/src/tanstack/layout/header.tsx',
)

describe('the front page is the real one', () => {
  it('renders the site homepage rather than a scaffold', () => {
    const source = code(ROUTE)

    expect(source).toMatch(/createFileRoute\('\/_main\/'\)/)
    expect(source).toMatch(
      /import \{ HomeRouteContent \} from '#\/site\/home\/home-content'/,
    )
    expect(source).toMatch(/component: HomeRoute/)
  })

  it('is a route file and not a page', () => {
    // The whole point of `#/site/home` existing. A line count rather than a
    // shape because the shape is asserted above; this is the thing a reviewer
    // would actually notice going wrong, which is the file growing a page.
    expect(code(ROUTE).split('\n').filter(Boolean).length).toBeLessThan(30)
  })

  it('takes its head from the metadata module, not from the page', () => {
    // `head` is not code-split - it is evaluated in the client entry on every
    // page of the application - so whatever module it reads from is loaded
    // everywhere. Importing the two strings from `home-content.tsx` would put
    // the hero, the marquee, the screenshot section and `motion` in that entry.
    const source = code(ROUTE)

    expect(source).toMatch(
      /import \{ HOME_DESCRIPTION, HOME_TITLE \} from '#\/site\/home\/metadata'/,
    )
    expect(code(join(siteDir, 'home/metadata.ts'))).not.toMatch(/home-content/)
  })

  it('fetches nothing, because it is marketing copy', () => {
    // No loader and no namespaces of its own: every string on the page is
    // English in the source, and the shell above it already warmed what the
    // header reads. A `useQuery` here would be the Stage 3 diagnostic again.
    const source = code(ROUTE)

    expect(source).not.toMatch(/\bloader\s*:/)
    expect(source).not.toMatch(/RouteMessages|NAMESPACES/)
    expect(code(HOME_CONTENT)).not.toMatch(/useQuery|useSuspenseQuery/)
  })
})

describe('the Stage 3 scaffold is gone', () => {
  const runtime = filesUnder(appSrc).filter(
    (path) => !path.includes(`${sep}tests${sep}`),
  )

  it('has files to check', () => {
    expect(runtime.length).toBeGreaterThan(20)
  })

  it.each([
    ['the stage name', /Stage 3/],
    ['the diagnostic probes', /data-testid=/],
    ['the toast demonstration', /Show a toast/],
    ['the runtime-verification copy', /runtime verification/i],
  ])('leaves no %s in anything this app renders', (_label, pattern) => {
    // Comments stripped: this file and the route file both *discuss* the
    // scaffold in prose, and explaining what was deleted is the opposite of
    // shipping it.
    const offenders = runtime
      .filter((path) => pattern.test(code(path)))
      .map((path) => relative(appSrc, path))

    expect(offenders).toEqual([])
  })
})

describe('the front page links', () => {
  it('sends Get Started to the docs through the injected link', () => {
    expect(code(HERO)).toMatch(/<LinkComponent[\s\S]*?href="\/docs\/dev"/)
  })

  it('decides nothing about how a path becomes a navigation', () => {
    // The rule a page most easily duplicates. A `startsWith('/docs')` here
    // would be a second, hand-written route table living on the front page -
    // which is what the docs migration would have broken, and what any future
    // move of that URL would break again.
    for (const path of filesUnder(siteDir)) {
      const source = code(path)
      const name = relative(appSrc, path)

      expect(source, name).not.toMatch(/startsWith\(\s*['"]\//)
      expect(source, name).not.toMatch(/window\.location/)
      expect(source, name).not.toMatch(
        /NEXT_PUBLIC_LEGACY_WEB_URL|legacyWebOrigin|buildLegacyHref/,
      )
    }
  })

  it('names the link component in the route file and nowhere under #/site', () => {
    // The sections take a `SiteLinkComponent` prop and only the route wires it,
    // which is the whole reason the front page survived three different answers
    // to "how does a path become a navigation" without a section being edited.
    const offenders = filesUnder(siteDir)
      .filter((path) => code(path).includes("from '@tanstack/react-router'"))
      .map((path) => relative(appSrc, path))

    expect(offenders).toEqual([])
    expect(code(ROUTE)).toMatch(/from '@vitnode\/core\/tanstack\/layout'/)
    expect(code(ROUTE)).toMatch(/LinkComponent=\{RouterLink\}/)
  })

  it('leaves VitNode by a plain anchor, not through the router', () => {
    // `github.com` is not a path, and a router asked to match one answers with
    // something broken rather than with the site the href named.
    //
    // Raw source rather than `code()`: the comment stripper is deliberately
    // naive and does not know that `//` inside a string is not a comment, so it
    // eats the rest of any line carrying a URL. That is harmless everywhere
    // else in this file and fatal to an assertion *about* a URL.
    expect(read(HERO)).toMatch(
      /<a[\s\S]*?href="https:\/\/github\.com\/VitNode\/vitnode"[\s\S]*?rel="noopener noreferrer"[\s\S]*?target="_blank"/,
    )
  })
})

/**
 * Stage 16 arrived, and the homepage did not change.
 *
 * This block replaced "the docs stay the legacy application's until Stage 16",
 * which asserted that no route file mentioned `docs` and that nothing in this
 * app imported Fumadocs. Both are now false by design, and what they were
 * guarding is stated as the thing that actually matters: the front page's Get
 * Started button became a client-side navigation **without the front page being
 * edited**, and Fumadocs stayed inside the documentation.
 */
describe('the docs are this application own, and the homepage did not notice', () => {
  it('has a /docs route in this route tree', () => {
    const routesDir = join(appSrc, 'routes')
    const docsRoutes = filesUnder(routesDir)
      .map((path) => relative(routesDir, path))
      .filter((path) => path.includes('docs'))

    expect(docsRoutes.sort()).toEqual([
      '_docs.tsx',
      `_docs${sep}docs.$.tsx`,
      `_docs${sep}docs.index.tsx`,
      'docs.search.ts',
    ])
  })

  it('still sends Get Started to /docs/dev through the same seam', () => {
    // The whole proof. Stage 15 wrote this href and this component; Stage 16
    // added the route files and changed neither, and the cutover changed only
    // which component the route passes in. `no-legacy-origin.test.ts` is the
    // other half - `/docs/dev` is a route in this tree, so the button is an
    // ordinary client-side navigation with no `/docs` special case anywhere.
    expect(code(HERO)).toMatch(/<LinkComponent[\s\S]*?href="\/docs\/dev"/)
    expect(code(ROUTE)).toMatch(/LinkComponent=\{RouterLink\}/)
  })

  it('keeps Fumadocs inside the documentation', () => {
    // `fumadocs-core/link` was the Next.js homepage's link component, and
    // carrying it across was the single most likely way for Stage 15 to start
    // Stage 16 by accident. The ban is now a boundary rather than a
    // prohibition: Fumadocs belongs to `src/docs`, to the routes that render it
    // and to the screenshot wrapper seven documents import by path - and to
    // nothing else, least of all `#/site`.
    const allowed = new Set([
      `components${sep}fumadocs${sep}img.tsx`,
      `routes${sep}_docs${sep}docs.$.tsx`,
      `routes${sep}_docs.tsx`,
      `routes${sep}docs.search.ts`,
    ])

    // Runtime files only: this suite and `docs-route.test.ts` both quote the
    // specifiers they assert about, so scanning them would fail on the
    // assertions' own text.
    const offenders = filesUnder(appSrc)
      .filter((path) => !path.includes(`${sep}tests${sep}`))
      .filter((path) => /from\s*["']fumadocs/.test(read(path)))
      .map((path) => relative(appSrc, path))
      .filter((path) => !path.startsWith(`docs${sep}`) && !allowed.has(path))

    expect(offenders).toEqual([])
  })
})

describe('this application does not reach into the legacy one', () => {
  it('imports no source file from apps/web', () => {
    // The mandatory boundary: `apps/web` is deleted in Stage 17, and anything
    // here that read from it would be deleted with it. The homepage's
    // screenshot, its technology marks and its beam were all moved rather than
    // imported for exactly this reason.
    // Import specifiers over comment-stripped source: several modules in this
    // application *name* `apps/web` in prose - the API config explains which
    // origin the legacy app serves, `isolation.test.ts` walks it - and saying
    // where the other application is, is not reaching into it.
    const offenders = filesUnder(appSrc)
      .filter((path) => /from\s*['"][^'"]*apps\/docs/.test(code(path)))
      .map((path) => relative(appSrc, path))

    expect(offenders).toEqual([])
  })
})

describe('the site owns its own static assets', () => {
  it.each(['admin-control-panel.png', 'favicon.ico'])(
    'serves %s from public/',
    (name) => {
      expect(existsSync(join(appSrc, '../public', name))).toBe(true)
    },
  )

  it('points the AdminCP section at the file it serves', () => {
    expect(code(join(siteDir, 'home/sections/admin-panel.tsx'))).toMatch(
      /src="\/admin-control-panel\.png"/,
    )
  })

  it('declares the favicon in the document head', () => {
    expect(code(join(appSrc, 'routes/__root.tsx'))).toMatch(
      /href: '\/favicon\.ico'[\s\S]*?rel: 'icon'/,
    )
  })
})

/**
 * Why the header had no logo, as a line in a stylesheet.
 *
 * `@vitnode/core` ships compiled, so Tailwind can only find a class in it by
 * being pointed at the build output. `dist/src/components` and `dist/src/views`
 * were listed; `dist/src/tanstack` was not - and the site header's default mark
 * is the only place in this application where `w-34` is written. The class was
 * never generated, the `<svg>` had a viewBox and no width, and an SVG with no
 * width does not fall back to its intrinsic size: it collapses.
 *
 * Nothing about that is visible from the header's source, from the logo's
 * source, or from a type error, which is why it is pinned as a line rather than
 * left to be rediscovered.
 */
describe('Tailwind can see the classes the package renders', () => {
  it.each(['components', 'tanstack', 'views'])(
    'scans dist/src/%s of @vitnode/core',
    (directory) => {
      expect(read(STYLES)).toMatch(
        new RegExp(
          `@source\\s+['"]\\.\\./node_modules/@vitnode/core/dist/src/${directory}['"]`,
        ),
      )
    },
  )

  /**
   * Fumadocs ships compiled for the same reason, so the documentation's chrome
   * is in the same position: not one of its classes is written in this
   * repository, and without this line the sidebar, the search dialog and the
   * table of contents render as unstyled markup.
   */
  it('scans the Fumadocs build output', () => {
    expect(read(STYLES)).toMatch(
      /@source\s+['"]\.\.\/node_modules\/fumadocs-ui\/dist\/\*\*\/\*\.js['"]/,
    )
  })
})

describe('the VitNode mark', () => {
  it('is core own, and this app implements no second one', () => {
    // One logo. `apps/web` had a byte-identical copy of `LogoVitNode` in its
    // own `src/components`; Stage 15 deleted it and repointed both importers at
    // the package. Nothing here may grow another.
    // Runtime files only: this suite necessarily quotes the two viewBoxes it is
    // looking for.
    const offenders = filesUnder(appSrc)
      .filter((path) => !path.includes(`${sep}tests${sep}`))
      .filter((path) =>
        /viewBox="0 0 762 191"|viewBox="0 0 375 376"/.test(read(path)),
      )
      .map((path) => relative(appSrc, path))

    expect(offenders).toEqual([])
    expect(code(HEADER)).toMatch(
      /import \{ LogoVitNodeBrand \} from '@vitnode\/core\/components\/logo-vitnode'/,
    )
  })

  it('is chosen by this host explicitly', () => {
    // The invariant: core's header supports a custom mark, and VitNode's own
    // site says out loud that it wants VitNode's.
    expect(code(HEADER)).toMatch(/logo=\{<LogoVitNodeBrand \/>\}/)
  })

  it('is still what core header falls back to', () => {
    // Not removed, because an application that passes nothing should still get
    // a header with a mark in it rather than a gap.
    expect(code(CORE_HEADER)).toMatch(/logo = <LogoVitNodeBrand \/>/)
  })

  /**
   * Two marks in one document, and the id collision that made one of them blank.
   *
   * Both variants paint with an SVG `<linearGradient>`, which a `fill` reaches by
   * id in *document* scope. `LogoVitNodeBrand` renders two of them and the front
   * page renders a third in the centre of its beam, so before this the page
   * carried the same `paint0_linear_123_23` twice - and the first of the two was
   * the header's `display: none` compact mark. Blink will not resolve a paint
   * server out of a subtree that is not rendered, so the beam's hexagon painted
   * with no fill: a white shape on a white card, on desktop only, and correct
   * again the moment the viewport crossed `sm` and the header's copy became
   * visible. Nothing about it was a type error and nothing about it was in the
   * markup.
   *
   * The rule is therefore about *this component's* two instances, which is the
   * only pair a static test can see. That the ids are built from the prefix at
   * all is asserted against the logo's own source, so a refactor that hardcodes
   * one again fails here rather than in a screenshot.
   */
  it('gives its two instances different gradient ids', () => {
    const source = code(LOGO)

    expect(source).toMatch(/idPrefix="vitnode-brand-wide"/)
    expect(source).toMatch(/idPrefix="vitnode-brand-compact"/)
    // Every gradient id and every reference to one is built from the prefix.
    expect(source).not.toMatch(/id="paint\d_linear/)
    expect(source).not.toMatch(/url\(#paint\d_linear/)
    expect(source.match(/\$\{idPrefix\}-/g) ?? []).toHaveLength(6)
  })

  it('needs no React hook, because Next renders it on the server', () => {
    // The AdminCP sidebar and the admin sign-in view are Server Components in
    // `apps/web`, and a `useId()` in here would throw in both. The uniqueness
    // is a prop for that reason, and this is what stops the reflex.
    expect(code(LOGO)).not.toMatch(/useId|useState|useEffect/)
  })

  it('is the wordmark on a wide viewport and the hexagon on a narrow one', () => {
    // Both are in the DOM and `hidden` is `display: none`, which takes an
    // element out of the accessibility tree as well as out of the layout - so
    // the link wrapping this has one accessible name at any width, not two.
    //
    // The second assertion is the failure this replaced: branding that is
    // simply hidden below `sm` rather than swapped for the compact mark.
    const source = code(LOGO)
    const brand = source.slice(source.indexOf('LogoVitNodeBrand'))

    expect(brand).toMatch(/className="hidden w-34 sm:block"/)
    expect(brand).toMatch(/className="size-8 sm:hidden"/)
    // The compact variant, and not a second wordmark scaled down.
    expect(brand).toMatch(/\bsmall\b/)
  })
})
