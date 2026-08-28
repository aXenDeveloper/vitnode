import { createMemoryHistory } from '@tanstack/react-router'
import {
  HEADER_HREF,
  headerNavItems,
} from '@vitnode/core/views/layouts/theme/header/header-nav'
import { describe, expect, it } from 'vitest'

import { switchLocaleOn } from '#/lib/i18n/client'
import { isTanStackOwnedPath } from '#/lib/migration-navigation'
import { getRouter } from '#/router'

/**
 * A router on a given public URL, the way the server builds one per request -
 * `createStartHandler` does exactly this, so what these tests drive is the real
 * route tree rather than a stand-in.
 */
const routerAt = (publicHref: string) => {
  const router = getRouter()
  router.update({
    ...router.options,
    history: createMemoryHistory({ initialEntries: [publicHref] }),
  })

  return router
}

/** Everywhere the header points: the logo, then the nav, in render order. */
const HEADER_LINKS = [
  HEADER_HREF.home,
  ...headerNavItems({ discover: 'Discover', search: 'Search' }).map(
    (item) => item.href,
  ),
]

/**
 * Which mechanism each header link navigates by.
 *
 * The header renders `MigrationLink`, which asks the route tree per href rather
 * than reading a list of migrated routes - so this is the question that decides
 * whether clicking "Discover" is a client-side transition or a full document
 * load into the Next.js app. All three of the header's destinations are this
 * app's today; the assertion is here so that stops being an assumption.
 */
describe('every header link is a client-side navigation', () => {
  it.each(HEADER_LINKS)('%s is served by this route tree', (href) => {
    expect(isTanStackOwnedPath(routerAt('/'), href)).toBe(true)
  })

  it.each(HEADER_LINKS)('%s is still owned when locale-prefixed', (href) => {
    // The prefix comes off before matching, which is the whole of Stage 3 - a
    // header rendered on `/pl` must not decide its own links are somebody
    // else's.
    const prefixed = href === '/' ? '/pl' : `/pl${href}`

    expect(isTanStackOwnedPath(routerAt('/pl'), prefixed)).toBe(true)
  })

  it('does not claim a route the Next.js app still serves', () => {
    // The control: without it, a rule that answered `true` for everything would
    // satisfy every assertion above - and would turn a working blog post into a
    // TanStack not-found.
    expect(isTanStackOwnedPath(routerAt('/'), '/blog/post-30')).toBe(false)
  })
})

/**
 * The language switcher, from the routes the header actually renders on.
 *
 * `locale-rewrite.test.ts` pins the rule itself on `/`; these are the two cases
 * the header exists to make reachable, on a real page and with a query string
 * and a hash to lose. Nothing here manipulates a path - `switchLocaleOn` is
 * Stage 3's own function, and the point is that the header needs no path
 * handling of its own.
 */
describe('switching language keeps the visitor where they are', () => {
  it('adds the prefix, keeping the search string and the hash', async () => {
    const router = routerAt('/discover?x=1#feed')

    await switchLocaleOn(router, 'pl')

    expect(router.latestLocation.publicHref).toBe('/pl/discover?x=1#feed')
    // The route tree never saw a locale, before or after.
    expect(router.latestLocation.pathname).toBe('/discover')
  })

  it('removes the prefix again for the default locale', async () => {
    const router = routerAt('/pl/search')

    await switchLocaleOn(router, 'en')

    expect(router.latestLocation.publicHref).toBe('/search')
    expect(router.latestLocation.pathname).toBe('/search')
  })

  it('is a history entry rather than a document load', async () => {
    const router = routerAt('/discover')
    const before = router.history.length

    await switchLocaleOn(router, 'pl')

    expect(router.history.length).toBe(before + 1)
  })
})
