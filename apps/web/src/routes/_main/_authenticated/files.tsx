import { createFileRoute } from '@tanstack/react-router'
import {
  loadMyFilesRoute,
  MyFilesRouteContent,
  myFilesRouteParams,
  normalizeMyFilesRouteSearch,
} from '@vitnode/core/tanstack/files'

import { pageHead } from '#/lib/page-head'

/**
 * The visitor's own files, rendered outside Next.js.
 *
 * One route file serving two public URLs. `/files` and `/pl/files` match *this*
 * route: the locale is stripped before matching and written back into every link
 * the router builds (`rewrite` in `src/router.tsx`), so nothing here mentions a
 * language and there is no `/pl/files.tsx` to keep in step. The Next.js route at
 * `packages/vitnode/src/routes/main/files/page.tsx` is still live and unchanged -
 * this is a parallel slice until the cutover.
 *
 * ## Where it sits, and what that buys
 *
 * Under `_authenticated`, which is a pathless layout: the file's *location* is
 * the guard, and this route contributes no URL segment of its own. There is
 * deliberately no session check in this file. The rule is
 * `routes/_main/_authenticated.tsx`, it runs in `beforeLoad` before any of this
 * renders, and it answers an anonymous visitor with `/login?returnTo=/files` -
 * carrying whatever sort and page they were heading for, and no locale, because
 * the rewrite writes that back on the way home. A second check here would not be
 * defence in depth, it would be a second rule to keep in step with the first.
 *
 * The actual boundary is neither: `GET /api/@vitnode/core/users/files` derives
 * the owner from the session cookie on every request.
 *
 * ## What is left in this file
 *
 * Topology, and the two things TanStack types from the path itself: the search
 * contract, and `navigate`. The query, the cache key's owner partition, the
 * namespaces, the title, the table and both deletes are
 * `@vitnode/core/tanstack/files`.
 */
export const Route = createFileRoute('/_main/_authenticated/files')({
  /**
   * The request, as the only thing the loader re-runs for.
   *
   * The *normalised* parameters rather than the raw search, and that is what
   * makes this exact. The router hands `loaderDeps` the validated search merged
   * over everything else that was in the query string, so keying on it directly
   * would re-run the loader for a stray `?utm_source=` - and, worse, would treat
   * `?first=10` and no `first` as two different pages of the same rows.
   */
  loaderDeps: ({ search }) => ({ params: myFilesRouteParams(search) }),
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context, deps }) =>
    await loadMyFilesRoute({ ...context, params: deps.params }),
  head: ({ loaderData }) =>
    pageHead({ robots: 'noindex, nofollow', ...loaderData }),
  validateSearch: normalizeMyFilesRouteSearch,
  component: MyFilesRoute,
})

/**
 * `navigate` and `search` are handed down because TanStack infers both from the
 * path above, which is why they cannot come from the package.
 */
function MyFilesRoute() {
  return (
    <MyFilesRouteContent
      {...Route.useLoaderData()}
      navigate={Route.useNavigate()}
      search={Route.useSearch()}
    />
  )
}
