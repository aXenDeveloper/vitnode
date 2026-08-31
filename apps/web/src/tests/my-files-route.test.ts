import { describe, expect, it } from 'vitest'

import { getRouter } from '#/router'

import { resolvesToRoute } from './route-tree'

/**
 * `/files`' place in this app's route tree.
 *
 * What the URL *means* - the six parameters, the defaults and clamps, the cache
 * entry each of them lands in, and which family a delete invalidates - is
 * `@vitnode/core/tanstack/files` and is asserted beside it in
 * `packages/vitnode/src/tanstack/files/route-search.test.ts`. Both applications
 * read that one contract, so restating any of it here would be a second copy
 * that agrees only until it doesn't.
 *
 * What is left is the half only this app can answer: that the route exists,
 * where it sits, and therefore that a link to it is a client-side navigation
 * rather than a document load into Next.js.
 */
describe('`/files` is this app’s route now', () => {
  const router = getRouter()

  it('is a route in this tree, so a link to it navigates client-side', () => {
    // There is no list of migrated routes anywhere in that decision - the route
    // tree is the list. Adding the route file is the whole of the handover.
    expect(resolvesToRoute(router, '/files')).toBe(true)
  })

  it('is owned under the locale prefix too, because that is the same route', () => {
    expect(resolvesToRoute(router, '/pl/files')).toBe(true)
  })

  it('is owned with the table’s own parameters on it', () => {
    expect(resolvesToRoute(router, '/files?orderBy=name&order=asc')).toBe(true)
  })

  it('does not drag the routes underneath it away from Next.js', () => {
    // `matchRoutes` answers with the deepest *branch* it can resolve, so owning
    // `/files` used to make anything below it look owned as well.
    expect(resolvesToRoute(router, '/files/12')).toBe(false)
  })

  it('sits under the main shell and the pathless guard, not at the top of the tree', () => {
    const matched = router.matchRoutes('/files', undefined) as {
      routeId: string
    }[]

    // Four pathless routes above the page and not one segment between them:
    // the shell, the container core's own screens hang from, the signed-in guard
    // nested in it, and `/files` itself.
    expect(matched.map((match) => match.routeId)).toEqual([
      '__root__',
      '/_main',
      '/_main/_core-main',
      '/_main/_core-main/_core-authenticated',
      '/_main/_core-main/_core-authenticated/files',
    ])
  })
})
