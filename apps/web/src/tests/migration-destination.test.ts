import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  migrationDestination,
  migrationNavigateOptions,
} from '#/migration/navigation'

/**
 * Where a validated internal path actually leads while half of VitNode still
 * runs on Next.js.
 *
 * The decision only - `isOwned` is an argument here, exactly as it is in the
 * function, because answering it needs a live router and this rule has to be
 * makeable on the server as well as in the browser. What the route tree answers
 * for a given URL is pinned in `plugin-routes.test.ts`.
 *
 * Two questions are kept apart on purpose, and this file only exercises the
 * second one:
 *
 *     safe   - may this app send a browser here?     `auth-return-to.test.ts`
 *     owned  - which application serves it?          here
 */

const LEGACY_ORIGIN = 'http://localhost:3000'

describe('a destination this app owns', () => {
  it('becomes a router navigation, with no locale of its own', () => {
    // Un-prefixed on purpose: `rewrite.output` writes the locale when the
    // location is built, so `/pl/pl/discover` is not a shape this can produce.
    expect(
      migrationDestination({
        href: '/discover',
        isOwned: true,
        legacyOrigin: LEGACY_ORIGIN,
        locale: 'pl',
      }),
    ).toEqual({ destination: { to: '/discover' }, type: 'tanstack' })
  })

  it('preserves the search parameters', () => {
    expect(
      migrationDestination({
        href: '/discover?sort=new',
        isOwned: true,
        locale: 'en',
      }),
    ).toEqual({
      destination: { search: { sort: 'new' }, to: '/discover' },
      type: 'tanstack',
    })
  })

  it('preserves the hash', () => {
    expect(
      migrationDestination({
        href: '/discover?sort=new#feed',
        isOwned: true,
        locale: 'en',
      }),
    ).toEqual({
      destination: {
        hash: 'feed',
        search: { sort: 'new' },
        to: '/discover',
      },
      type: 'tanstack',
    })
  })

  /**
   * The route tree has no locale in it, so what the router is handed must not
   * either - `rewrite.output` writes the prefix back when the location is built.
   *
   * The normal flow already produces an internal path: `returnTo` is built from
   * `location.pathname`, which the rewrite has already stripped. This is about
   * the spelling nothing stops a visitor from typing -
   * `/pl/login?returnTo=/pl/discover` - which `sanitizeReturnTo` accepts because
   * it is a perfectly safe application path. Handing `/pl/discover` to the
   * router as `to` would name a route that does not exist.
   */
  it('strips a locale prefix somebody put in the returnTo', () => {
    expect(
      migrationDestination({
        href: '/pl/discover',
        isOwned: true,
        locale: 'pl',
      }),
    ).toEqual({ destination: { to: '/discover' }, type: 'tanstack' })
  })

  it('strips the prefix and keeps the search and hash', () => {
    expect(
      migrationDestination({
        href: '/pl/discover?sort=new#feed',
        isOwned: true,
        locale: 'pl',
      }),
    ).toEqual({
      destination: {
        hash: 'feed',
        search: { sort: 'new' },
        to: '/discover',
      },
      type: 'tanstack',
    })
  })

  /**
   * Stage 3's own rule, not a prefix check written here: `/admin` carries no
   * locale in the first place, so there is nothing to strip and a segment that
   * merely looks like one is left alone.
   */
  it('leaves a path outside the localized URL space alone', () => {
    expect(
      migrationDestination({
        href: '/admin/core',
        isOwned: true,
        locale: 'pl',
      }),
    ).toEqual({ destination: { to: '/admin/core' }, type: 'tanstack' })
  })

  it('does not mistake an unrelated first segment for a locale', () => {
    expect(
      migrationDestination({ href: '/plugins', isOwned: true, locale: 'pl' }),
    ).toEqual({ destination: { to: '/plugins' }, type: 'tanstack' })
  })
})

describe('a destination the legacy application still serves', () => {
  it('becomes a full URL at the legacy origin, localized exactly once', () => {
    expect(
      migrationDestination({
        href: '/settings/security?tab=devices',
        isOwned: false,
        legacyOrigin: LEGACY_ORIGIN,
        locale: 'pl',
      }),
    ).toEqual({
      href: 'http://localhost:3000/pl/settings/security?tab=devices',
      type: 'legacy',
    })
  })

  it('takes no prefix for the default locale', () => {
    expect(
      migrationDestination({
        href: '/settings/security',
        isOwned: false,
        legacyOrigin: LEGACY_ORIGIN,
        locale: 'en',
      }),
    ).toEqual({
      href: 'http://localhost:3000/settings/security',
      type: 'legacy',
    })
  })

  it('preserves the hash', () => {
    expect(
      migrationDestination({
        href: '/blog/post-1#comments',
        isOwned: false,
        legacyOrigin: LEGACY_ORIGIN,
        locale: 'en',
      }),
    ).toEqual({
      href: 'http://localhost:3000/blog/post-1#comments',
      type: 'legacy',
    })
  })

  it('keeps exactly one prefix on an href that already carries it', () => {
    // `buildLegacyHref` localizes with the same Stage 3 rule, and that rule is
    // idempotent - so the legacy branch deliberately does *not* de-localize
    // first. `/pl/pl/...` is not a shape this can produce.
    expect(
      migrationDestination({
        href: '/pl/settings/security',
        isOwned: false,
        legacyOrigin: LEGACY_ORIGIN,
        locale: 'pl',
      }),
    ).toEqual({
      href: 'http://localhost:3000/pl/settings/security',
      type: 'legacy',
    })
  })

  it('stays relative when no legacy origin is configured', () => {
    // The deployment where a proxy in front of both apps routes by path. The
    // navigation still has to leave this router, which is what
    // `migrationNavigateOptions` insists on below.
    expect(
      migrationDestination({
        href: '/settings',
        isOwned: false,
        locale: 'pl',
      }),
    ).toEqual({ href: '/pl/settings', type: 'legacy' })
  })

  it('never takes an origin from the path it was given', () => {
    // The origin is application configuration. `sanitizeReturnTo` has already
    // refused anything that could name one, and this is the second lock: a path
    // is resolved *against* the configured origin, never trusted to supply one.
    const { href } = migrationDestination({
      href: '/settings',
      isOwned: false,
      legacyOrigin: LEGACY_ORIGIN,
      locale: 'en',
    }) as { href: string }

    expect(new URL(href).origin).toBe(LEGACY_ORIGIN)
  })
})

describe('turning a destination into redirect or navigate options', () => {
  it('hands an owned destination straight through', () => {
    expect(
      migrationNavigateOptions({
        destination: { search: { sort: 'new' }, to: '/discover' },
        type: 'tanstack',
      }),
    ).toEqual({ search: { sort: 'new' }, to: '/discover' })
  })

  /**
   * `reloadDocument` is set rather than inferred. An absolute href infers it on
   * its own, but a relative legacy href - the no-configured-origin deployment -
   * would not, and inferring nothing there turns the one navigation that must
   * leave this router into a client-side one to a route it cannot render.
   */
  it.each(['http://localhost:3000/pl/settings', '/pl/settings'])(
    'always leaves the router for the legacy href %s',
    (href) => {
      expect(migrationNavigateOptions({ href, type: 'legacy' })).toEqual({
        href,
        reloadDocument: true,
      })
    },
  )
})

/**
 * The quarantine.
 *
 * Everything in `src/migration` exists only because half of VitNode still runs
 * on Next.js, and all of it is deleted at cutover - the legacy origin, the
 * per-href "which application serves this" rule, the link that asks it, and the
 * three shell slots that exist only to hand that link to a core component. The
 * point of the directory is that the cutover is `rm -rf src/migration` plus the
 * imports this pins, rather than a hunt through `lib/` and `components/`.
 *
 * So: nothing outside it may hold a second copy of the rule, and the routes that
 * import it are the routes that will have to change. Both are checked on the
 * source, because neither is a runtime behaviour.
 */
const appSrc = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const sourcesUnder = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) return sourcesUnder(path)

    return /\.tsx?$/.test(entry.name) ? [path] : []
  })

describe('the migration layer stays in one place', () => {
  const outside = sourcesUnder(appSrc).filter(
    (path) =>
      !path.startsWith(join(appSrc, 'migration')) &&
      !path.startsWith(join(appSrc, 'tests')),
  )

  it('has files to check', () => {
    expect(outside.length).toBeGreaterThan(10)
  })

  it('is the only place that knows about the legacy application', () => {
    // The env var and the origin it names. A second reader of it is a second
    // thing to find at cutover.
    const offenders = outside.filter((path) =>
      /NEXT_PUBLIC_LEGACY_WEB_URL|legacyWebOrigin|buildLegacyHref/.test(
        readFileSync(path, 'utf8'),
      ),
    )

    expect(offenders.map((path) => relative(appSrc, path))).toEqual([])
  })

  it('is reached only from route files, which is what cutover edits', () => {
    const offenders = outside.filter(
      (path) =>
        !path.startsWith(join(appSrc, 'routes')) &&
        path !== join(appSrc, 'router.tsx') &&
        /from '#\/migration\/|from '\.\/migration\//.test(
          readFileSync(path, 'utf8'),
        ),
    )

    expect(offenders.map((path) => relative(appSrc, path))).toEqual([])
  })
})
