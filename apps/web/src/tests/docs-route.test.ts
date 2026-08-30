import { createMemoryHistory } from '@tanstack/react-router'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { DOCS_SEARCH_PATH } from '#/docs/search-path'
import { docsSectionOf } from '#/docs/section'
import { getRouter } from '#/router'

import { withoutComments } from './source'

/**
 * `/docs/*`, as this application's route tree actually serves it.
 *
 * Static and type-level only, by the migration testing policy. What the
 * documentation *looks* like is not asserted anywhere - that is a browser's job,
 * and a snapshot of Fumadocs' markup would fail on every upstream release. What
 * is asserted here is topology: which route answers for which URL, that the
 * locale rewrite reaches it, that the splat claims the documentation and nothing
 * else, and that no second locale model was introduced along the way.
 *
 * The pieces checked elsewhere, so this file does not restate them:
 * `plugin-routes.test.ts` asks `isTanStackOwnedPath` about `/docs`,
 * `docs-source.test.ts` covers the copied content and the source loader, and
 * `isolation.test.ts` walks the documentation's runtime graph for Next.js.
 */
const here = dirname(fileURLToPath(import.meta.url))
const appSrc = resolve(here, '..')
const routesDir = join(appSrc, 'routes')

const filesUnder = (directory: string): string[] => {
  if (!existsSync(directory)) return []

  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)

    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

const routeFiles = filesUnder(routesDir).map((path) =>
  relative(routesDir, path),
)

/**
 * A router on a given public URL, the way the server builds one per request.
 *
 * The same helper `locale-rewrite.test.ts` uses, for the same reason: this is
 * what `createStartHandler` does, so what these tests drive is the real thing.
 */
const routerAt = (publicHref: string) => {
  const router = getRouter()
  router.update({
    ...router.options,
    history: createMemoryHistory({ initialEntries: [publicHref] }),
  })

  return router
}

const deepestRouteId = (publicHref: string): string | undefined => {
  const router = routerAt(publicHref)

  return router.matchRoutes(router.latestLocation.pathname).at(-1)?.routeId
}

describe('the documentation is one logical route', () => {
  it.each([
    ['/docs/dev', '/_docs/docs/$'],
    ['/docs/dev/plugins/create', '/_docs/docs/$'],
    ['/docs/ui/button', '/_docs/docs/$'],
    ['/docs/guides/blog', '/_docs/docs/$'],
    // A URL with no document behind it still matches: the 404 is the loader's
    // answer, not the router's. That is what keeps `/docs/nope` a documentation
    // page that says "not found" rather than a bare router error screen.
    ['/docs/does-not-exist', '/_docs/docs/$'],
    ['/docs', '/_docs/docs/'],
  ])('%s is served by %s', (pathname, routeId) => {
    expect(deepestRouteId(pathname)).toBe(routeId)
  })

  /**
   * The same routes, reached through the locale rewrite.
   *
   * This is the whole reason there is no `$lang` in the tree: `/pl/docs/dev`
   * arrives, `rewrite.input` strips the prefix, and the *same* route matches.
   * The public URL and the internal one differ; the route does not.
   */
  it.each([
    ['/pl/docs/dev', '/docs/dev', '/_docs/docs/$'],
    [
      '/pl/docs/dev/plugins/create',
      '/docs/dev/plugins/create',
      '/_docs/docs/$',
    ],
    ['/pl/docs', '/docs', '/_docs/docs/'],
  ])('%s matches %s on %s', (publicHref, pathname, routeId) => {
    const router = routerAt(publicHref)

    expect(router.latestLocation.pathname).toBe(pathname)
    expect(router.latestLocation.publicHref).toBe(publicHref)
    expect(deepestRouteId(publicHref)).toBe(routeId)
  })

  it('claims the documentation and nothing beside it', () => {
    // The reason the splat is `/docs/$` and not `/$`. Each of these resolves to
    // its own route or to none at all; a root catch-all would have swallowed
    // every one.
    expect(deepestRouteId('/discover')).toBe('/_main/discover')
    expect(deepestRouteId('/settings')).toBe('/_main/_authenticated/settings/')
    expect(deepestRouteId('/admin')).toBe('/admin/')
    expect(deepestRouteId('/example')).toBe('/_main/_plugins/example')
    // Not a route at all - which is the point: an unmatched path 404s rather
    // than being annexed by the documentation.
    expect(deepestRouteId('/docsomething')).toBe('__root__')
    expect(deepestRouteId('/blog/post-30')).toBe('__root__')
  })
})

/**
 * No `$lang`, anywhere.
 *
 * Fumadocs' own TanStack Start examples route documentation as `/$lang/docs/$`,
 * because Fumadocs has no other locale mechanism to offer. VitNode has had one
 * since Stage 3, and a physical language segment would be a second model
 * competing with it: two places that decide what `/pl` means, disagreeing the
 * first time a language is added.
 *
 * Asserted as a property of the whole route tree rather than of the documentation
 * alone, because the mistake this prevents is copying an upstream example into
 * *any* route directory.
 */
describe('no locale is a route segment', () => {
  it('has no $lang, $locale or $lng route file', () => {
    expect(
      routeFiles.filter((path) => /\$(lang|locale|lng)/i.test(path)),
    ).toEqual([])
  })

  it('has no physical /en or /pl route file', () => {
    expect(
      routeFiles.filter((path) => /(^|[./])(en|pl)[./]/.test(path)),
    ).toEqual([])
  })

  it('never names a locale inside the documentation implementation', () => {
    // The other half of the same rule: no `href.startsWith("/docs")` and no
    // hand-built `/pl/...`. Every documentation link is built by the router,
    // which applies the prefix through `rewrite.output`.
    for (const path of filesUnder(join(appSrc, 'docs'))) {
      if (!/\.tsx?$/.test(path)) continue

      const source = withoutComments(path)
      const name = relative(appSrc, path)

      expect(source, name).not.toMatch(/['"`]\/pl\b/)
      expect(source, name).not.toMatch(/\$\{locale\}/)
      expect(source, name).not.toMatch(/startsWith\(\s*['"]\/docs/)
    }
  })
})

/**
 * `/api/*` is still Hono's, and Fumadocs did not take a path inside it.
 *
 * The default `useDocsSearch({ type: "fetch" })` endpoint is `/api/search`, and
 * accepting that default is the single easiest way for a documentation
 * migration to put a second server inside the application's API namespace. The
 * search index lives at `/docs/search` instead - see `src/docs/search-path.ts`.
 */
describe('the API namespace stays Hono own', () => {
  it('serves /api/* from the Hono bridge', () => {
    expect(deepestRouteId('/api/core/members/me')).toBe('/api/$')
    expect(deepestRouteId('/api/search')).toBe('/api/$')
  })

  it('routes documentation search outside /api', () => {
    expect(DOCS_SEARCH_PATH).toBe('/docs/search')
    expect(DOCS_SEARCH_PATH.startsWith('/api')).toBe(false)
    expect(deepestRouteId(DOCS_SEARCH_PATH)).toBe('/docs/search')
  })

  it('declares no route file under /api but the bridge', () => {
    expect(routeFiles.filter((path) => path.startsWith('api'))).toEqual([
      join('api', '$.ts'),
    ])
  })

  it('never configures the Fumadocs search client with an /api path', () => {
    const dialog = withoutComments(join(appSrc, 'docs/search-dialog.tsx'))

    expect(dialog).toContain('DOCS_SEARCH_PATH')
    expect(dialog).not.toMatch(/api:\s*['"]\/api/)
  })

  /**
   * `/docs/search` shadows a document, because a static segment outranks a
   * splat. There is no such document, and this is what stops one being added by
   * accident: a `content/docs/search.mdx` would be indexed by the search it made
   * unreachable, which is exactly the kind of failure nobody would think to look
   * for.
   */
  it('shadows no document that exists', () => {
    const content = join(appSrc, '../content/docs')

    expect(existsSync(join(content, 'search.mdx'))).toBe(false)
    expect(existsSync(join(content, 'search.md'))).toBe(false)
    expect(existsSync(join(content, 'search'))).toBe(false)
  })
})

/**
 * The documentation shell is its own, and the front page's is untouched.
 *
 * Fumadocs' notebook layout is a full site chrome - a top bar with the mark, the
 * GitHub link, a search trigger and a theme switcher. Rendering it under `_main`
 * would put two of each on every documentation page.
 */
describe('the docs shell is separate from the main shell', () => {
  it('mounts the docs routes under _docs and not under _main', () => {
    expect(deepestRouteId('/docs/dev')?.startsWith('/_docs/')).toBe(true)
    expect(deepestRouteId('/discover')?.startsWith('/_main/')).toBe(true)
  })

  it('renders no MainHeader inside the documentation', () => {
    for (const path of filesUnder(join(appSrc, 'docs'))) {
      if (!/\.tsx?$/.test(path)) continue

      expect(withoutComments(path), relative(appSrc, path)).not.toMatch(
        /MainHeader|ThemeLayoutContent/,
      )
    }
  })

  it('mounts the Fumadocs provider around the docs subtree only', () => {
    const shell = withoutComments(join(appSrc, 'docs/shell-content.tsx'))
    const root = withoutComments(join(appSrc, 'routes/__root.tsx'))

    expect(shell).toContain("from 'fumadocs-ui/provider/tanstack'")
    expect(root).not.toMatch(/fumadocs/)
  })

  it('never reaches for the Next provider', () => {
    // A different module for a different framework, and what a mechanical port
    // of the Next.js layout would have brought across.
    //
    // Runtime files only: this suite necessarily names the specifier it is
    // looking for, so scanning itself would fail on the assertion's own text.
    const nextProvider = ['fumadocs-ui', 'provider', 'next'].join('/')
    const runtime = filesUnder(appSrc).filter(
      (path) => /\.tsx?$/.test(path) && !path.includes(`${sep}tests${sep}`),
    )

    expect(runtime.length).toBeGreaterThan(20)

    for (const path of runtime) {
      expect(withoutComments(path), relative(appSrc, path)).not.toContain(
        nextProvider,
      )
    }
  })
})

/**
 * One Tailwind build per document, and it is a correctness rule rather than a
 * budget.
 *
 * Stage 16 shipped the Fumadocs design system as a stylesheet the `/docs` route
 * declared in its own `head`, so that a reader of the front page would not
 * download it. That is measurably wrong, and the way it fails is worth keeping
 * written down because it looks like anything but a CSS problem.
 *
 * TanStack Router renders every `rel="stylesheet"` link with React's
 * `precedence` attribute - see `Asset.tsx` in `@tanstack/react-router` - and
 * React 19 hoists such a stylesheet into `<head>` **for the life of the
 * document**. It is never removed when the route unmounts, deliberately, so that
 * navigating back does not flash unstyled content. So a route-owned stylesheet
 * is not route-owned at all: one visit to `/docs` puts it on every page after
 * it, in the same browsing session.
 *
 * And two Tailwind builds share one `@layer utilities`. The docs sheet emitted
 * 61 kB of utilities, 265 of whose class selectors also existed in
 * `src/styles.css`; loaded second, each of those 265 outranked the app's copy -
 * variants included, because a variant is just a later rule in the same layer.
 * `.hidden` beat `.sm:block`, `LogoVitNodeBrand` is `hidden w-34 sm:block`, and
 * the site header lost its wordmark on the home page - but only for somebody who
 * had opened the documentation first, which is why it survived a full crawl of
 * every route.
 *
 * The rule is therefore "this application ships one Tailwind entry", asserted
 * three ways: nothing else imports Tailwind, no route declares a stylesheet, and
 * the documentation's theme is in the one sheet that exists.
 */
describe('the application has exactly one stylesheet', () => {
  const cssFiles = (directory: string): string[] =>
    filesUnder(directory).filter((path) => path.endsWith('.css'))

  it('imports Tailwind from src/styles.css and nowhere else', () => {
    const importers = cssFiles(appSrc).filter((path) =>
      /@import\s+["']tailwindcss/.test(readFileSync(path, 'utf8')),
    )

    expect(importers.map((path) => relative(appSrc, path))).toEqual([
      'styles.css',
    ])
  })

  it('keeps the documentation theme in that same sheet', () => {
    const styles = readFileSync(join(appSrc, 'styles.css'), 'utf8')

    expect(styles).toMatch(/@import\s+['"]fumadocs-ui\/css\/preset\.css['"]/)
    expect(styles).toMatch(/@import\s+['"]fumadocs-ui\/css\/neutral\.css['"]/)
  })

  it('declares no stylesheet on any route but the root', () => {
    // `__root` links `styles.css`, which is the one document-level stylesheet.
    // A `?url` CSS import anywhere else is the shape this rule exists to stop.
    const offenders = filesUnder(routesDir)
      .filter((path) => /\.tsx?$/.test(path))
      .filter((path) =>
        /\.css\?url|rel:\s*'stylesheet'/.test(withoutComments(path)),
      )
      .map((path) => relative(routesDir, path))

    expect(offenders).toEqual(['__root.tsx'])
  })

  it('leaves no stylesheet in the documentation implementation', () => {
    expect(cssFiles(join(appSrc, 'docs'))).toEqual([])
  })
})

/** The section accent, which is a pure function of the internal pathname. */
describe('docsSectionOf', () => {
  it.each([
    ['/docs/dev', 'dev'],
    ['/docs/dev/plugins/create', 'dev'],
    ['/docs/ui/button', 'ui'],
    ['/docs/guides', 'guides'],
    ['/docs', undefined],
    ['/docs/', undefined],
    ['/discover', undefined],
    ['/', undefined],
  ])('reads %s as %s', (pathname, section) => {
    expect(docsSectionOf(pathname)).toBe(section)
  })
})
