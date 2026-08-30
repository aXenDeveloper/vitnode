import { createFileRoute } from '@tanstack/react-router'

import { pageHead } from '#/lib/page-head'
import { MigrationLink } from '#/migration/link'
import { HomeRouteContent } from '#/site/home/home-content'
import { HOME_DESCRIPTION, HOME_TITLE } from '#/site/home/metadata'

/**
 * The front page of vitnode.com, on TanStack Start.
 *
 * One route file serving two public URLs: `/` and `/pl` both match here, because
 * the locale is stripped before matching and written back into every link the
 * router builds. There is no `routes/pl/index.tsx` and there is not going to be.
 *
 * What the page *is* lives beside it in `#/site/home` - see `home-content.tsx`,
 * which states why this site's own marketing page is the application's and not
 * `@vitnode/core`'s. What is left here is topology: where the route sits, and
 * what the tab says.
 *
 * ## What used to be here
 *
 * Stage 3's runtime-verification scaffold - a card of labelled rows proving the
 * locale resolved, the QueryClient was warm, the theme switcher worked and the
 * toaster was mounted. It said so itself: "It is a scaffold, and the real
 * homepage replaces it when one is designed." It is deleted rather than moved,
 * because everything it demonstrated is asserted by a test that cannot be
 * satisfied by a page nobody visits: `locale-rewrite.test.ts` for the two URLs,
 * `router-query.test.ts` for the single QueryClient, `intl-runtime.test.ts` for
 * the message records. A diagnostic that is also production UI is a diagnostic
 * nobody trusts and a homepage nobody wants.
 *
 * **`head` must be written after `loader`** on routes that have one - `loaderData`
 * is inferred from `loader` in the same object literal, and TypeScript reads a
 * literal's members in order. This route has no loader: it fetches nothing,
 * because it is marketing copy and the shell above it already warmed everything
 * the header reads.
 *
 * `HOME_TITLE` and `HOME_DESCRIPTION` come from `metadata.ts` rather than from
 * the module beside them on purpose. `head` is not code-split - it is evaluated
 * in the client entry, on every page of the application - so importing them from
 * `home-content.tsx` would put the hero, the marquee and `motion` in the entry
 * chunk. `src/tests/eager-graph.test.ts` is the rule; this is one instance of it.
 */
export const Route = createFileRoute('/_main/')({
  head: () =>
    pageHead({
      description: HOME_DESCRIPTION,
      robots: 'index, follow',
      title: HOME_TITLE,
    }),
  component: HomeRoute,
})

/**
 * `MigrationLink` rather than the router's `Link`, and the same wrapper
 * `/discover` uses for the same reason: the page's primary call to action points
 * at `/docs/dev`, which the Next.js application serves until Stage 16.
 *
 * The seam is named *here* rather than inside the page because a route file is
 * where this application keeps every migration decision - one grep, one cutover
 * edit, and `src/tests/migration-destination.test.ts` is what keeps it that way.
 * The page and every section under it take a link component and hold no opinion
 * about which application answers for a path.
 */
function HomeRoute() {
  return <HomeRouteContent LinkComponent={MigrationLink} />
}
