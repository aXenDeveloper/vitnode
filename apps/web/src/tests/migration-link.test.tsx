// @vitest-environment jsdom
import type { AnyRouter } from '@tanstack/react-router'

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { createLocaleRewrite } from '#/lib/i18n/client'

import {
  isTanStackOwnedPath,
  MigrationLink,
} from '#/components/migration-link'
import { getRouter } from '#/router'

/**
 * The migration navigation boundary.
 *
 * `apps/web` owns three routes; every other VitNode page is still served by the
 * Next.js app. A search result points wherever the indexed content lives, so
 * this is the rule that decides whether a hit becomes a client-side navigation
 * or a document load - and getting it wrong turns a working blog post into a
 * TanStack not-found page.
 *
 * The route tree is the source of truth. Nothing here lists migrated routes, so
 * nothing here has to change when one migrates.
 */

const routerAt = (publicHref: string): AnyRouter => {
  const router = getRouter()
  router.update({
    ...router.options,
    history: createMemoryHistory({ initialEntries: [publicHref] }),
  })

  return router
}

describe('isTanStackOwnedPath', () => {
  const router = routerAt('/discover')

  it.each([
    '/',
    '/discover',
    // Through the locale rewrite: the route tree has no locale in it, so the
    // prefix has to come off before the router is asked.
    '/pl/discover',
    '/pl/discover/',
    // `matchRoutes` takes a pathname; a query or hash left on would match nothing.
    '/discover?sort=newest',
    '/discover#results',
    '/pl/discover?sort=newest#results',
  ])('owns %s', (href) => {
    expect(isTanStackOwnedPath(router, href)).toBe(true)
  })

  it.each([
    // Not migrated yet - all of these are still served by the Next.js app.
    '/blog/post-30',
    '/blog',
    '/pl/blog/post-30',
    '/files/report.pdf',
    '/admin',
    '/admin/users',
    '/search?search=hello',
    // A plugin route this app has never heard of.
    '/@some-plugin/thing/42',
    '/unknown-plugin/thing',
  ])('leaves %s to the legacy app', (href) => {
    expect(isTanStackOwnedPath(router, href)).toBe(false)
  })

  it.each(['/api', '/api/@vitnode/core/search', '/pl/api/x'])(
    'never treats %s as a page',
    (href) => {
      // `/api/$` really is in the route tree - it is how Hono is mounted - so it
      // matches. It renders nothing, and a client-side navigation to it would
      // show a blank page instead of calling the API.
      expect(isTanStackOwnedPath(router, href)).toBe(false)
    },
  )

  it('would fail loudly if a root-level catch-all were added', () => {
    // The rule is "something below the root matched". A `routes/$.tsx` would
    // make every path match, so every legacy link would silently become a
    // client-side navigation into a not-found page. This is the tripwire; the
    // "leaves %s to the legacy app" cases above are the other half of it.
    const ids = Object.keys(router.routesById)

    expect(ids).toContain('/discover')
    expect(ids).not.toContain('/$')
    expect(ids.filter((id) => id.split('/').at(1) === '$')).toEqual([])
  })

  it('is a page route test, not a route-tree-shape test', () => {
    // `/api/$` is in the tree the *server* builds and pruned from the one the
    // browser gets - Start drops a route whose only option is `server`. So the
    // guard in `isApiRouteId` is load-bearing on one side and belt-and-braces
    // on the other, and neither side may treat the mount as a page.
    expect(isTanStackOwnedPath(router, '/api/@vitnode/core/search')).toBe(false)
  })
})

/**
 * Rendering, and then clicking.
 *
 * The suite above asks the *real* route tree what it owns. This one cannot boot
 * it: mounting the app's router runs the root loader, whose messages come from a
 * `createServerFn`, and a server function needs the Start server context that
 * only `createStartHandler` installs - outside it, every render is an error
 * boundary. `src/tests/discover-route.test.ts` drives the real thing through
 * that handler.
 *
 * So the router here is a stand-in with the same *shape*: the same locale
 * rewrite, an owned route, and nothing that fetches. What is under test is the
 * link's behaviour given a router, and the router it is given answers
 * `matchRoutes` exactly as the real one does.
 */
const renderAt = async (publicHref: string, href: string) => {
  const holder: { current?: AnyRouter } = {}

  const rootRoute = createRootRoute({ component: Outlet })
  const routes = ['/', '/discover'].map((path) =>
    createRoute({
      component: () => <MigrationLink href={href}>result title</MigrationLink>,
      getParentRoute: () => rootRoute,
      path,
    }),
  )
  const apiRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/api/$',
  })

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [publicHref] }),
    rewrite: createLocaleRewrite(() => holder.current),
    routeTree: rootRoute.addChildren([...routes, apiRoute]),
  })
  holder.current = router as unknown as AnyRouter

  await router.load()
  const view = render(<RouterProvider router={router} />)

  return { router: router as unknown as AnyRouter, view }
}

describe('the rendered href', () => {
  it('routes an owned path client-side, unprefixed on the default locale', async () => {
    await renderAt('/discover', '/discover')

    expect(screen.getByText('result title').getAttribute('href')).toBe(
      '/discover',
    )
  })

  it('routes an owned path client-side, prefixed on a localized page', async () => {
    // The prefix comes from the router's own `rewrite.output`. Adding one in the
    // link would produce `/pl/pl/discover`.
    await renderAt('/pl/discover', '/discover')

    expect(screen.getByText('result title').getAttribute('href')).toBe(
      '/pl/discover',
    )
  })

  it('links a legacy path as a plain document href', async () => {
    await renderAt('/discover', '/blog/post-1')

    expect(screen.getByText('result title').getAttribute('href')).toBe(
      '/blog/post-1',
    )
  })

  it('localizes a legacy path for the page it is rendered on', async () => {
    await renderAt('/pl/discover', '/blog/post-1')

    expect(screen.getByText('result title').getAttribute('href')).toBe(
      '/pl/blog/post-1',
    )
  })

  it('never double-prefixes a legacy path that already carries one', async () => {
    await renderAt('/pl/discover', '/pl/blog/post-1')

    const href = screen.getByText('result title').getAttribute('href')

    expect(href).toBe('/pl/blog/post-1')
    expect(href).not.toContain('/pl/pl/')
  })

  it('keeps the search string and hash on a legacy path', async () => {
    await renderAt('/pl/discover', '/blog/post-1?tab=comments#top')

    expect(screen.getByText('result title').getAttribute('href')).toBe(
      '/pl/blog/post-1?tab=comments#top',
    )
  })

  it('keeps the search string and hash on an owned path', async () => {
    await renderAt('/pl/discover', '/discover?sort=newest#results')

    expect(screen.getByText('result title').getAttribute('href')).toBe(
      '/pl/discover?sort=newest#results',
    )
  })

  it('leaves an ignored path unprefixed even on a localized page', async () => {
    // `/admin` is outside the localized URL space - Stage 3's rule, applied by
    // the same helper rather than re-decided here.
    await renderAt('/pl/discover', '/admin/users')

    expect(screen.getByText('result title').getAttribute('href')).toBe(
      '/admin/users',
    )
  })
})

/**
 * The behaviour the href alone does not prove.
 *
 * An `<a href>` and a `<Link to>` can render identical markup; what separates
 * them is what happens on click. A legacy result must let the browser perform a
 * document load - which is what jsdom reports as "the default was not
 * prevented" - rather than being captured by the router and resolved against a
 * route tree that has never heard of it.
 */
describe('clicking a legacy result does not enter the router', () => {
  const click = (element: Element) =>
    fireEvent(
      element,
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    )

  it('lets the browser navigate to an unmigrated route', async () => {
    const { router } = await renderAt('/discover', '/blog/post-30')
    const before = router.state.location.pathname

    const captured = click(screen.getByText('result title'))

    // `fireEvent` returns false when something called `preventDefault()` - i.e.
    // when the router took the navigation. Nothing did, so the document load
    // proceeds and the Next.js app answers it.
    expect(captured).toBe(true)
    expect(router.state.location.pathname).toBe(before)
    expect(router.state.location.pathname).not.toBe('/blog/post-30')
  })

  it('does not resolve the unmigrated route against this route tree', async () => {
    const { router } = await renderAt('/discover', '/blog/post-30')

    click(screen.getByText('result title'))
    await router.load()

    // The proof that matters: no not-found. Had the click entered the router,
    // `/blog/post-30` would have matched nothing and rendered one.
    expect(router.state.matches.at(-1)?.routeId).toBe('/discover')
    expect(router.state.statusCode).not.toBe(404)
  })

  it('does capture a click on a route this app does own', async () => {
    const { router } = await renderAt('/', '/discover')

    const captured = click(screen.getByText('result title'))

    // The control: the same component, an owned path, and the router takes it.
    expect(captured).toBe(false)
    await router.load()
    expect(router.state.location.pathname).toBe('/discover')
  })
})
