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
 * `collectionLabels` is not passed, and that is this app's answer rather than an
 * omission: the names for Content Engine collections come from the frontend
 * content-type registry, which is server-side config kept out of the browser
 * bundle by `vitnode.shell.config.ts`, and this app registers no content types
 * at all (see `src/vitnode.config.ts`). It is the same seam `AdminShell` leaves
 * open for `declarations`, and it changes here when plugin AdminCP registration
 * moves over.
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
