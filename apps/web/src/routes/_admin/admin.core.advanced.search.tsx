import { createFileRoute } from '@tanstack/react-router'
import { AdminBreadcrumb } from '@vitnode/core/tanstack/admin'
import {
  AdminSearchIndexRouteContent,
  loadAdminSearchIndexRoute,
  normalizeSearchIndexRouteSearch,
} from '@vitnode/core/tanstack/admin/search-index'

import { pageHead } from '#/lib/page-head'

/**
 * `/admin/core/advanced/search` - the search index's health.
 *
 * Topology only. The status query, the permission (`system.can_view`), the
 * namespaces, the title, both mutations and the collections table are
 * `@vitnode/core/tanstack/admin/search-index`.
 *
 * No `loaderDeps`: the screen is one status read, and `?search=` filters the
 * collection list *in the browser* rather than in a request - the whole list
 * arrives at once. So typing in the search box changes the URL and re-renders,
 * and does not re-run the loader.
 *
 * `collectionLabels` is still not passed. The names for Content Engine
 * collections are the plural nouns a content type's own messages spell, and
 * until Stage 13 this app had no content-type registry at all to read them from.
 * It has one now - `src/lib/content-registry.ts` - so the remaining cost is the
 * strings: resolving those nouns means warming every configured plugin's content
 * namespaces on a screen that renders none of them otherwise, which is a
 * decision for whoever picks this up rather than part of moving the Content
 * Engine. Without them a content collection falls back to the search renderer's
 * own label and still shows its `itemType`, so nothing is hidden - it is named
 * less well.
 */
export const Route = createFileRoute('/_admin/admin/core/advanced/search')({
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context }) => await loadAdminSearchIndexRoute(context),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  validateSearch: normalizeSearchIndexRouteSearch,
  component: AdminSearchIndexRoute,
  staticData: {
    breadcrumb: <AdminBreadcrumb segments={['core', 'advanced', 'search']} />,
  },
})

function AdminSearchIndexRoute() {
  return (
    <AdminSearchIndexRouteContent
      {...Route.useLoaderData()}
      navigate={Route.useNavigate()}
      search={Route.useSearch()}
    />
  )
}
