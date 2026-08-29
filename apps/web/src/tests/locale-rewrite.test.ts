import { createMemoryHistory } from '@tanstack/react-router'
import {
  publicPathnameOf,
  resolveLocale,
  switchLocaleOn,
} from '@vitnode/core/tanstack/i18n'
import { describe, expect, it } from 'vitest'

import { getRouter } from '#/router'

/**
 * A router on a given public URL, the way the server builds one per request.
 *
 * `createStartHandler` does exactly this - `router.update({ history })` with a
 * memory history seeded from the request - so what these tests drive is the
 * real thing rather than a stand-in.
 */
const routerAt = (publicHref: string) => {
  const router = getRouter()
  router.update({
    ...router.options,
    history: createMemoryHistory({ initialEntries: [publicHref] }),
  })

  return router
}

/**
 * The two halves of the rewrite, over the app's real route tree.
 *
 * The property being pinned is that there is *one* `/` route and it answers on
 * two URLs. Nothing in `src/routes` mentions a locale, and after Stage 4 nothing
 * will: `/discover` will be one file, reachable at `/discover` and
 * `/pl/discover`.
 */
describe('one route tree, two public URL shapes', () => {
  it.each([
    ['/', '/', 'en'],
    ['/pl', '/', 'pl'],
    ['/pl/', '/', 'pl'],
  ])('%s matches the route %s in %s', (publicHref, pathname, locale) => {
    const router = routerAt(publicHref)

    expect(router.latestLocation.pathname).toBe(pathname)
    expect(router.latestLocation.publicHref).toBe(publicHref)
    expect(
      router.matchRoutes(router.latestLocation.pathname).at(-1)?.routeId,
    ).toBe('/_main/')
    expect(router.state.location.pathname).toBe(pathname)
    // The locale the rest of the app reads, from the same location.
    expect(
      new URL(publicHref, 'https://x.test').pathname.startsWith('/pl'),
    ).toBe(locale === 'pl')
  })

  it('keeps the search string and the hash through the rewrite', () => {
    const router = routerAt('/pl?q=foo&page=2#top')

    expect(router.latestLocation.pathname).toBe('/')
    expect(router.latestLocation.searchStr).toBe('?q=foo&page=2')
    expect(router.latestLocation.hash).toBe('top')
  })

  it('does not read an unknown first segment as a locale', () => {
    // The whole reason no `{-$locale}` layout route exists: without one there is
    // nothing for `/xx/...` to match, so it 404s on its own. A layout route
    // would match it and then need a `beforeLoad` to reject what it matched.
    const router = routerAt('/xx')

    expect(router.latestLocation.pathname).toBe('/xx')
    expect(
      router.matchRoutes(router.latestLocation.pathname).at(-1)?.routeId,
    ).toBe('__root__')
  })

  it('leaves the API route out of it entirely', () => {
    const router = routerAt('/api/core/members/me')

    expect(router.latestLocation.pathname).toBe('/api/core/members/me')
    expect(router.latestLocation.publicHref).toBe('/api/core/members/me')
  })
})

describe('links carry the current locale', () => {
  it('prefixes nothing in the default locale', () => {
    const router = routerAt('/')

    expect(router.buildLocation({ to: '/' }).publicHref).toBe('/')
  })

  it('prefixes every link when the page is prefixed', () => {
    const router = routerAt('/pl')

    const built = router.buildLocation({ to: '/' })

    // The route tree still sees `/`; only the href the browser gets changes.
    expect(built.href).toBe('/')
    expect(built.publicHref).toBe('/pl')
  })

  it('keeps search params on a localized link', () => {
    const router = routerAt('/pl')

    expect(
      router.buildLocation({ search: { q: 'foo' }, to: '/' }).publicHref,
    ).toBe('/pl?q=foo')
  })

  it('never prefixes an ignored path', () => {
    const router = routerAt('/pl')

    // `<Link to="/admin/users">` from a Polish page must not become
    // `/pl/admin/users` - that URL redirects straight back.
    expect(router.buildLocation({ to: '/admin/users' as '/' }).publicHref).toBe(
      '/admin/users',
    )
  })
})

/**
 * Switching language, which is the one navigation the rewrite cannot express on
 * its own: `/discover` and `/pl/discover` are the same internal location, so
 * `navigate()` sees nothing to move to. `useSwitchLocale` pushes the public href
 * instead - the same call the router makes at the end of every navigation.
 */
describe('switching language moves the public URL and nothing else', () => {
  it('goes from the default locale to a prefixed URL', async () => {
    const router = routerAt('/')

    await switchLocaleOn(router, 'pl')

    expect(router.latestLocation.publicHref).toBe('/pl')
    expect(router.latestLocation.pathname).toBe('/')
  })

  it('goes back to the unprefixed URL, keeping the search string', async () => {
    const router = routerAt('/pl?q=hello')

    await switchLocaleOn(router, 'en')

    expect(router.latestLocation.publicHref).toBe('/?q=hello')
    expect(router.latestLocation.pathname).toBe('/')
    expect(router.latestLocation.search).toEqual({ q: 'hello' })
  })

  it('keeps the hash', async () => {
    const router = routerAt('/pl#section')

    await switchLocaleOn(router, 'en')

    expect(router.latestLocation.publicHref).toBe('/#section')
  })

  it('is a history entry, not a document load', async () => {
    const router = routerAt('/')
    const before = router.history.length

    await switchLocaleOn(router, 'pl')

    expect(router.history.length).toBe(before + 1)
    expect(router.history.location.href).toBe('/pl')
  })

  it('changes no URL on a route that has none to change', async () => {
    // `/admin` is outside the localized URL space: the cookie the switcher
    // writes is the whole switch, and the invalidation is what shows it.
    const router = routerAt('/admin/users')
    const before = router.history.length

    await switchLocaleOn(router, 'pl')

    expect(router.latestLocation.publicHref).toBe('/admin/users')
    expect(router.history.length).toBe(before)
  })

  it('ignores a language this app does not serve', async () => {
    const router = routerAt('/')

    // No cast any more: the package types a locale as `string`, because it is
    // installed by apps with different language lists. Which strings are real
    // is `configureIntl`'s answer, and this asserts it is still enforced.
    await switchLocaleOn(router, 'xx')

    expect(router.latestLocation.publicHref).toBe('/')
  })
})

/**
 * The locale as loaders see it.
 *
 * The root route's `beforeLoad` resolves it once per load and puts it in the
 * router context, which is what Stage 4's routes will read - `loader: ({
 * context }) => context.locale`. It comes from the same function the rewrite and
 * the components use, so there is one answer rather than one per consumer.
 */
describe('loaders read the locale off the router context', () => {
  const localeInContext = async (publicHref: string) => {
    const router = routerAt(publicHref)
    await router.load()

    return (
      router.state.matches.at(0)?.context as undefined | { locale?: string }
    )?.locale
  }

  it('is the URL locale on a public route', async () => {
    expect(await localeInContext('/')).toBe('en')
    expect(await localeInContext('/pl')).toBe('pl')
  })

  it('comes back in step after a language switch', async () => {
    // The internal URL does not change when the language does, so nothing looks
    // stale to the router - which is why `switchLocaleOn` invalidates.
    const router = routerAt('/')
    await router.load()

    await switchLocaleOn(router, 'pl')

    expect(
      (router.state.matches.at(0)?.context as { locale?: string }).locale,
    ).toBe('pl')
  })
})

/**
 * The chain the provider hangs off: public location -> locale -> query key.
 *
 * `useLocale` is `useRouterState` over exactly this, so a switch that moves the
 * public URL is a switch that re-renders the provider with new messages - with
 * no reload, and without anything reading `window` during a render.
 */
describe('router state is what the language follows', () => {
  it('changes the resolved locale when the public URL moves', async () => {
    const router = routerAt('/pl?q=hello')
    await router.load()

    expect(resolveLocale(publicPathnameOf(router.state.location))).toBe('pl')

    await switchLocaleOn(router, 'en')

    expect(router.state.location.publicHref).toBe('/?q=hello')
    expect(resolveLocale(publicPathnameOf(router.state.location))).toBe('en')
  })
})
