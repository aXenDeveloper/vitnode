import { createFileRoute } from '@tanstack/react-router'
import {
  loadSearchRoute,
  normalizeSearchRouteSearch,
  SearchRouteContent,
} from '@vitnode/core/tanstack/search'

import { pageHead } from '#/lib/page-head'
import { MigrationLink } from '#/migration/link'

/**
 * Search, rendered outside Next.js.
 *
 * One route file serving two public URLs. `/search` and `/pl/search` match
 * *this* route: the locale is stripped before matching and written back into
 * every link the router builds (`rewrite` in `src/router.tsx`), so nothing here
 * mentions a language and there is no `/pl/search.tsx` to keep in step. The
 * Next.js route at `packages/vitnode/src/routes/main/search/page.tsx` is still
 * live and unchanged - this is a parallel slice until the cutover.
 *
 * The search box, the type filters, the sort, the feed, the namespaces they are
 * translated through and the one query definition the loader and the controls
 * share are all `@vitnode/core/tanstack/search`. What is left here is topology
 * and the migration link.
 */
export const Route = createFileRoute('/_main/search')({
  /**
   * The loader re-runs when the term in the URL changes, and only then. Without
   * this it would warm the feed for whatever term the page was first opened with
   * and never again, so following a link from `/search?search=hono` to
   * `/search?search=drizzle` would render the first result set and fetch the
   * second from the browser.
   */
  loaderDeps: ({ search }) => ({ search: search.search }),
  // `head` after `loader`, always - see the note in `discover.tsx`.
  loader: async ({ context, deps }) =>
    await loadSearchRoute({ ...context, search: deps.search }),
  head: ({ loaderData }) =>
    pageHead({ robots: 'index, follow', ...loaderData }),
  validateSearch: normalizeSearchRouteSearch,
  component: SearchRoute,
})

/** See `discover.tsx` for why a result's link is `MigrationLink`. */
function SearchRoute() {
  return (
    <SearchRouteContent
      {...Route.useLoaderData()}
      LinkComponent={MigrationLink}
    />
  )
}
