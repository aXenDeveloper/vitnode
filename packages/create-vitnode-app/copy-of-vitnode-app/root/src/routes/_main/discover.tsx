import { createFileRoute } from '@tanstack/react-router'
import { RouterLink } from '@vitnode/core/tanstack/layout'
import {
  DiscoverRouteContent,
  loadDiscoverRoute,
} from '@vitnode/core/tanstack/search'

import { pageHead } from '#/lib/page-head'

/**
 * Discover.
 *
 * One route file serving two public URLs. `/discover` and `/pl/discover` match
 * *this* route: the locale is stripped before matching and written back into
 * every link the router builds (`rewrite` in `src/router.tsx`), so nothing here
 * mentions a language and there is no `/pl/discover.tsx` to keep in step.
 *
 * Everything the page *is* - which namespaces it warms, the feed it ensures, the
 * two strings its heading and tab title share, and the markup below both - is
 * `@vitnode/core/tanstack/search`. What is left here is this application's
 * topology: where the route sits, and the one thing a package cannot answer,
 * which is how to build a link.
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
 * A search result points wherever the indexed content lives, and the shared feed
 * is host-neutral by design - so the link is a required prop rather than an
 * import, and this route supplies core's own `RouterLink`. The locale prefix is
 * applied exactly once, by the rewrite, when the router builds the href.
 *
 * External and unsafe URLs never reach it: `SearchFeedContent` classifies those
 * and renders them itself.
 */
function DiscoverRoute() {
  return (
    <DiscoverRouteContent
      {...Route.useLoaderData()}
      LinkComponent={RouterLink}
    />
  )
}
