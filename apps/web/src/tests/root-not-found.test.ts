import { describe, expect, it } from 'vitest'

import { getRouter } from '#/router'

/**
 * What a URL nothing matched gets.
 *
 * There are two 404s in this application and they are answered in different
 * places, which is the whole of what this file pins:
 *
 *     matched, then `notFound()`   the nearest `notFoundComponent` above it
 *     matched nothing at all       the root's
 *
 * The second had no answer until now. TanStack Router falls back to its own bare
 * `<p>Not Found</p>` when neither the root route nor `createRouter` declares
 * one, and warns about it on every such navigation - so `/admin/contents`, a
 * stale bookmark and any path the Next.js application still serves all landed on
 * an unstyled page with no way back.
 *
 * `matchRoutes` is the router's own answer and runs no loader, so what is
 * asserted here is the *tree*: which routes a path resolves to, and whether the
 * deepest of them consumed it.
 */

const matchedIds = (pathname: string): string[] =>
  getRouter()
    .matchRoutes(pathname, undefined)
    .map((match) => match.routeId)

describe('the root route answers for everything unmatched', () => {
  it('declares a notFoundComponent', () => {
    // The option itself, because its absence is not a failure anywhere else:
    // the router renders *something* either way, and the difference only shows
    // up as an unstyled page and a console warning.
    expect(
      getRouter().routesById.__root__.options.notFoundComponent,
    ).toBeDefined()
  })

  it.each([
    // Pages nothing in this tree declares. A link to one of these is a document
    // navigation - every link goes through the router - so what reaches the root
    // is somebody typing or a stale bookmark.
    '/blog/post-30',
    '/users/aXen',
    '/nope',
  ])('%s resolves to the root and nothing else', (pathname) => {
    expect(matchedIds(pathname)).toEqual(['__root__'])
  })

  /**
   * `/admin/…` is the one prefix where "nothing else" needs saying carefully.
   *
   * `/admin` itself is a route - the AdminCP's sign-in, which
   * `withCoreRootRoutes` mounts under a pathless container on the root - so
   * `matchRoutes` answers with that route as the deepest *ancestor* it can reach
   * and leaves the rest of the path unconsumed. That is the same behaviour
   * `/login/something-else` has, and it is why `resolvesToRoute` compares the
   * matched pathname to the requested one rather than counting matches.
   *
   * What must not happen is a *leaf* claiming these: no route consumes the whole
   * path, so nothing renders an AdminCP screen for a URL no screen declares.
   */
  it.each(['/admin/contents', '/admin/core/not-migrated-yet'])(
    '%s reaches no route that consumes it',
    (pathname) => {
      const matched = getRouter().matchRoutes(pathname, undefined) as {
        pathname: string
      }[]

      expect(matched.at(-1)?.pathname).not.toBe(pathname)
    },
  )

  /**
   * The half that must not regress with it.
   *
   * `/admin/content/nope` names no content type, but it *matches* - the Content
   * Engine owns the whole namespace - so its loader answers `notFound()` and
   * `_admin`'s component renders the message inside the panel. Sending it to the
   * root instead would drop an administrator out of the AdminCP for a typo.
   */
  it.each(['/admin/content/nope', '/admin/content/blog/articles/9999/edit'])(
    '%s stays inside the admin shell',
    (pathname) => {
      expect(matchedIds(pathname)).toContain('/_admin')
      expect(matchedIds(pathname)).not.toEqual(['__root__'])
    },
  )
})
