import { createFileRoute } from '@tanstack/react-router'
import {
  AdminDebugRouteContent,
  debugLogsRouteParams,
  loadAdminDebugRoute,
  normalizeDebugRouteSearch,
} from '@vitnode/core/tanstack/admin/debug'

import { pageHead } from '#/lib/page-head'
import { MigrationLink } from '#/migration/link'

/**
 * `/admin/core/debug` - the debug panel: the queue snapshot, the system log, and
 * "clear the cache".
 *
 * Topology only. The queries, the permission (`debug.can_view` to open it,
 * `debug.can_clear_cache` for the button), the namespaces, the titles and all
 * three sections are `@vitnode/core/tanstack/admin/debug`.
 *
 * `MigrationLink` is passed because the log's detail dialog links a line to the
 * user who caused it, at `/admin/core/users/{id}` - a screen the Next.js AdminCP
 * still serves. The link asks the route tree per href, so this becomes a client
 * navigation the day that screen migrates, with no edit here.
 *
 * ## No breadcrumb, deliberately
 *
 * The Next.js AdminCP renders none for this screen: there is no
 * `@breadcrumb/admin/core/debug` slot, so the `[...all]` catch-all answers with
 * `null`. `staticData.breadcrumb: null` is that same answer stated where this
 * router can see it - and stating it is the point, because `undefined` would
 * *inherit* a parent's crumb rather than mean "this page has none". Giving the
 * panel a trail is a product decision, and it belongs in both applications at
 * once rather than arriving as a side effect of a runtime migration.
 */
export const Route = createFileRoute('/_admin/admin/core/debug')({
  /**
   * The system log's parameters. It is the only thing on the screen with URL
   * state - the queue snapshot has no pager and the clear-cache button writes
   * nothing - so the screen's search is the log table's.
   */
  loaderDeps: ({ search }) => ({ params: debugLogsRouteParams(search) }),
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context, deps }) =>
    await loadAdminDebugRoute({ ...context, params: deps.params }),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  validateSearch: normalizeDebugRouteSearch,
  component: AdminDebugRoute,
  staticData: { breadcrumb: null },
})

function AdminDebugRoute() {
  return (
    <AdminDebugRouteContent
      {...Route.useLoaderData()}
      LinkComponent={MigrationLink}
      navigate={Route.useNavigate()}
      search={Route.useSearch()}
    />
  )
}
