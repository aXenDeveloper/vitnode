import { createFileRoute } from '@tanstack/react-router'
import {
  DiscoverRouteContent,
  loadDiscoverRoute,
} from '@vitnode/core/tanstack/search'

import { pageHead } from '#/lib/page-head'
import { MigrationLink } from '#/migration/link'

/**
 * Discover, the first VitNode route to render outside Next.js.
 *
 * One route file serving two public URLs. `/discover` and `/pl/discover` match
 * *this* route: the locale is stripped before matching and written back into
 * every link the router builds (`rewrite` in `src/router.tsx`), so nothing here
 * mentions a language and there is no `/pl/discover.tsx` to keep in step. The
 * Next.js route at `packages/vitnode/src/routes/main/discover/page.tsx` is still
 * live and unchanged - this is a parallel slice until the cutover.
 *
 * Everything the page *is* - which namespaces it warms, the feed it ensures, the
 * two strings its heading and tab title share, and the markup below both - is
 * `@vitnode/core/tanstack/search`. What is left here is this application's
 * topology: where the route sits, and the one thing a package cannot answer,
 * which is how to build a link while half of VitNode still runs on Next.js.
 *
 * **`head` must be written after `loader`**: `loaderData`'s type is inferred
 * from `loader` in the same object literal, and TypeScript reads a literal's
 * members in order - put `head` first and `loaderData` is `never`. Neither error
 * names the cause.
 */
export const Route = createFileRoute('/_main/discover')({
  loader: async ({ context }) => await loadDiscoverRoute(context),
  head: ({ loaderData }) =>
    pageHead({ robots: 'index, follow', ...loaderData }),
  component: DiscoverRoute,
})

/**
 * `MigrationLink` rather than the router's `Link`, because a search result
 * points wherever the indexed content lives and most of VitNode has not moved
 * yet. It asks the route tree whether this app can render the destination:
 * `/discover` is a client-side navigation, `/blog/post-30` is a document load
 * into the Next.js app that still serves it. Either way the locale prefix is
 * applied exactly once.
 */
function DiscoverRoute() {
  return (
    <DiscoverRouteContent
      {...Route.useLoaderData()}
      LinkComponent={MigrationLink}
    />
  )
}
