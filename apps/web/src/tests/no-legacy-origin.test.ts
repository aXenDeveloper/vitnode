import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { getRouter } from '#/router'

import { resolvesToRoute } from './route-tree'
import { withoutComments } from './source'

/**
 * The migration is over, stated as things that must not exist.
 *
 * For most of this app's life two applications served one site, and a routing
 * compatibility layer decided per URL which of them a click went to: a link
 * component that asked the route tree whether this app owned a path, a second
 * web origin to send the rest to, and the same question again for a navigation
 * nobody clicked. Every URL is this application's now, so all of it is deleted.
 *
 * Deleting it is easy to do incompletely, and the leftovers are quiet: a
 * variable nothing reads still appears in a `.env` a new deployment copies, and
 * a helper nothing calls still tells the next reader that a second application
 * exists. So the absence is asserted rather than assumed.
 *
 * Pure and static. Nothing here renders, and nothing here needs a browser: the
 * first half is a scan over source, the second asks the real route tree about
 * real URLs. There are no `RouterProvider` tests, by the same policy the rest of
 * this directory follows.
 */

const appSrc = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = resolve(appSrc, '..')

const sourcesUnder = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) return sourcesUnder(path)

    return /\.tsx?$/.test(entry.name) ? [path] : []
  })

const sources = sourcesUnder(appSrc)

/**
 * The application's own source - everything under `src` that is not a test.
 *
 * The scans below are over this rather than over `sources`, and the exclusion is
 * load-bearing rather than convenient: a test asserting that `.env.example` does
 * *not* contain `NEXT_PUBLIC_LEGACY_WEB_URL` has to write the name down to say
 * so, and it is the opposite of an offender. Including tests would make every
 * such assertion fail this one, and the way to make it pass again would be to
 * delete the assertion.
 *
 * Comments are stripped on top of that, because this codebase explains itself:
 * several files legitimately name the removed mechanism in prose to say why it
 * is gone. `source.ts` exists for exactly this.
 */
const appSources = sources.filter(
  (path) => !path.startsWith(join(appSrc, 'tests')),
)

const codeOf = (path: string): string => withoutComments(path)

const offendersMatching = (pattern: RegExp): string[] =>
  appSources
    .filter((path) => pattern.test(codeOf(path)))
    .map((path) => relative(appSrc, path))

describe('the legacy origin is gone', () => {
  it('has files to scan', () => {
    expect(appSources.length).toBeGreaterThan(50)
  })

  /**
   * The variable itself, in code and in the two files that configured it.
   *
   * A dummy left behind with an empty value would be worse than none: it is
   * configuration a deployment can set, that nothing reads, that says a second
   * application exists.
   */
  it('is named in no source file', () => {
    expect(offendersMatching(/NEXT_PUBLIC_LEGACY_WEB_URL/)).toEqual([])
  })

  it.each(['.env.example', 'vite.config.ts'])(
    'is not configured in %s',
    (file) => {
      expect(readFileSync(join(appRoot, file), 'utf8')).not.toContain(
        'NEXT_PUBLIC_LEGACY_WEB_URL',
      )
    },
  )

  it('has no helper left that builds an href at another origin', () => {
    expect(offendersMatching(/buildLegacyHref|legacyWebOrigin/)).toEqual([])
  })

  it('publishes no application-specific key to the browser bundle', () => {
    // `vitNodeEnv()` bare. The package still inlines its own two keys; this app
    // adds none, which is what an app with one origin should need.
    const config = withoutComments(join(appRoot, 'vite.config.ts'))

    expect(config).toMatch(/vitNodeEnv\(\)/)
    expect(config).not.toContain('clientEnv')
  })
})

describe('the routing compatibility layer is gone', () => {
  it('has no migration link component', () => {
    expect(offendersMatching(/MigrationLink/)).toEqual([])
  })

  it('has no per-href ownership question', () => {
    expect(
      offendersMatching(/isTanStackOwnedPath|useMigrationNavigate|ownsPath/),
    ).toEqual([])
  })

  it('has no migration directory', () => {
    expect(offendersMatching(/#\/migration\/|\.\/migration\//)).toEqual([])
  })

  /**
   * The thing the compatibility layer was careful never to become, and the thing
   * most likely to be reintroduced by somebody solving a routing problem in a
   * hurry: a hand-written table of which URLs this application serves.
   *
   * The route tree is that table. A literal prefix test against a product URL is
   * how a second one starts.
   */
  it('branches on no hard-coded internal URL prefix', () => {
    expect(
      offendersMatching(
        /(?:startsWith|includes)\(\s*['"]\/(?:docs|blog|admin|discover|search|files|settings|login|register)/,
      ),
    ).toEqual([])
  })
})

/**
 * The other direction, and the one that would still matter if every scan above
 * passed on an app that had simply deleted its links.
 *
 * A representative URL from each surface the compatibility layer used to
 * classify - the front page, the feeds, the auth screens, the settings panels,
 * the AdminCP, the documentation, a plugin's page - asked of the real route
 * tree. Every one of them is a route here now; several were a full-document load
 * into another application at some point during the migration, and `/docs` was
 * the last of them.
 *
 * Both spellings of each, because a localized URL is not a different route: the
 * rewrite strips `/pl` before matching and writes it back into every link the
 * router builds, so no route file mentions a language and nothing in the app
 * prepends one.
 */
describe('every representative URL is a route in this tree', () => {
  const router = getRouter()

  const PATHS = [
    '/',
    '/discover',
    '/search',
    '/files',
    '/login',
    '/login/reset-password',
    '/login/sso/google',
    '/register',
    '/settings',
    '/settings/security',
    '/settings/devices',
    '/docs/dev',
    '/example',
  ] as const

  it.each(PATHS)('serves %s', (pathname) => {
    expect(resolvesToRoute(router, pathname)).toBe(true)
  })

  it.each(PATHS)('serves the Polish spelling of %s', (pathname) => {
    expect(
      resolvesToRoute(router, `/pl${pathname === '/' ? '' : pathname}`),
    ).toBe(true)
  })

  /**
   * The AdminCP carries no locale in any language - `DEFAULT_IGNORED_LOCALE_PATHS`
   * lists `/admin` with its descendants - so it is asserted in one spelling
   * rather than two.
   */
  it.each([
    '/admin',
    '/admin/core',
    '/admin/core/users',
    '/admin/core/staff/admins',
    '/admin/content/blog/articles',
  ])('serves %s', (pathname) => {
    expect(resolvesToRoute(router, pathname)).toBe(true)
  })

  /**
   * Query and hash ride along untouched, which is what a `?returnTo=` carrying
   * either depends on.
   */
  it('serves a URL with search parameters and a hash', () => {
    expect(resolvesToRoute(router, '/discover?sort=new#feed')).toBe(true)
    expect(resolvesToRoute(router, '/pl/files?orderBy=name&order=asc')).toBe(
      true,
    )
  })
})
