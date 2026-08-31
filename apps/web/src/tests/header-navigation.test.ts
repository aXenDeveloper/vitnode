import { createMemoryHistory } from '@tanstack/react-router'
import { switchLocaleOn } from '@vitnode/core/tanstack/i18n'
import {
  HEADER_HREF,
  headerNavItems,
} from '@vitnode/core/views/layouts/theme/header/header-nav'
import {
  USER_HEADER_HREF,
  userHeaderMenu,
  userProfileHref,
} from '@vitnode/core/views/layouts/theme/header/user/user-header-model'
import { describe, expect, it } from 'vitest'

import { getRouter } from '#/router'

import { resolvesToRoute } from './route-tree'

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
 * The header renders `RouterLink`, which hands the href to the router rather
 * than reading a list of migrated routes - so this is the question that decides
 * whether clicking "Discover" is a client-side transition or a full document
 * load into the Next.js app. All three of the header's destinations are this
 * app's today; the assertion is here so that stops being an assumption.
 */
describe('every header link is a client-side navigation', () => {
  it.each(HEADER_LINKS)('%s is served by this route tree', (href) => {
    expect(resolvesToRoute(routerAt('/'), href)).toBe(true)
  })

  it.each(HEADER_LINKS)('%s is still owned when locale-prefixed', (href) => {
    // The prefix comes off before matching, which is the whole of Stage 3 - a
    // header rendered on `/pl` must not decide its own links are somebody
    // else's.
    const prefixed = href === '/' ? '/pl' : `/pl${href}`

    expect(resolvesToRoute(routerAt('/pl'), prefixed)).toBe(true)
  })

  it('does not claim a route the Next.js app still serves', () => {
    // The control: without it, a rule that answered `true` for everything would
    // satisfy every assertion above - and would turn a working blog post into a
    // TanStack not-found.
    expect(resolvesToRoute(routerAt('/'), '/blog/post-30')).toBe(false)
  })
})

/**
 * The user area of the header.
 *
 * `USER_HEADER_HREF` is ordinary data in `@vitnode/core` - a record of five
 * paths, shared verbatim with the Next.js header - and it says nothing about
 * which application serves any of them. That is the property worth pinning here
 * rather than the individual answers: the header points at a mixture of migrated
 * and routes this app declares, the router resolves each href, and the
 * *model* needs no edit when a route moves.
 *
 * Stage 9 is the proof. `/settings` and `/register` were full document loads
 * into the Next.js app when Stage 8 mounted this header; they are client-side
 * navigations now, and the diff that did it added route files and touched
 * neither `user-header-model.ts` nor a link component.
 */
describe('the user menu navigates by what the route tree serves', () => {
  const owns = (href: string): boolean => resolvesToRoute(routerAt('/'), href)

  /**
   * The guest controls and the account links, split by which application renders
   * them today. Both halves matter: the first is what Stage 9 changed, and the
   * second is what stops "owned" from being the answer to everything.
   */
  it.each([
    [USER_HEADER_HREF.files, true],
    [USER_HEADER_HREF.settings, true],
    [USER_HEADER_HREF.signIn, true],
    [USER_HEADER_HREF.signUp, true],
    // Flipped by Stage 12, and the flip is the point: the AdminCP entrance is a
    // route in this tree now (`routes/admin.index.tsx`), so the menu item is a
    // client-side navigation rather than a document load. Nothing in
    // `user-header-model.ts` or a link component changed to do it - the
    // route tree is the table, exactly as it was for `/settings` in Stage 9.
    //
    // Only the *entrance* moved, not the panel: `/admin/core` is served here
    // too, while `/admin/content/*` and the rest of `/admin/*` stay unowned and
    // keep loading into the Next.js app. `admin-routes.test.ts` pins that line.
    [USER_HEADER_HREF.adminCp, true],
  ])('%s is served by this route tree: %s', (href, expected) => {
    expect(owns(href)).toBe(expected)
  })

  it('leaves the profile page to the application that has one', () => {
    // `/users/<code>` is not a route in this tree, and a name code is not a
    // shape this app should start claiming by prefix.
    expect(owns(userProfileHref('test-1'))).toBe(false)
  })

  /**
   * Every item the menu actually renders, rather than every key the record
   * holds - `userHeaderMenu` is what decides which of them a given visitor sees,
   * and an item added to it without a route behind it is a link to a 404 in one
   * application or a not-found in the other.
   */
  it('resolves every menu item a signed-in admin is shown', () => {
    const items = userHeaderMenu({
      avatarColor: '#000000',
      isAdmin: true,
      name: 'Test',
      nameCode: 'test-1',
    }).flat()

    expect(items.map((item) => item.key)).toEqual([
      'my_profile',
      'files',
      'settings',
      'admin_cp',
    ])

    // Owned or not, every destination is an application-relative path with no
    // locale in it: the prefix is the router rewrite's to write, on whichever
    // branch it takes.
    for (const { href } of items) {
      expect(href.startsWith('/')).toBe(true)
      expect(href).not.toMatch(/^\/[a-z]{2}\//)
    }
  })

  it('keeps the migrated ones owned when locale-prefixed', () => {
    // A header rendered on `/pl` builds `/pl/settings`, and the prefix comes off
    // before matching - otherwise reading Polish would silently move the whole
    // user menu back onto the Next.js app.
    for (const href of [USER_HEADER_HREF.settings, USER_HEADER_HREF.signUp]) {
      expect(resolvesToRoute(routerAt('/pl'), `/pl${href}`)).toBe(true)
    }
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
