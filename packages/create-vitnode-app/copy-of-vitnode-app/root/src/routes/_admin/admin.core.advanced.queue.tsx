import { createFileRoute } from '@tanstack/react-router'
import { AdminBreadcrumb } from '@vitnode/core/tanstack/admin'
import {
  AdminQueueRouteContent,
  loadAdminQueueRoute,
  normalizeQueueRouteSearch,
  queueRouteParams,
} from '@vitnode/core/tanstack/admin/queue'

import { pageHead } from '#/lib/page-head'

/**
 * `/admin/core/advanced/queue` - the background-task queue.
 *
 * Topology only. The query, the permission (`queue.can_view`), the namespaces,
 * the title, the status filter and the table are
 * `@vitnode/core/tanstack/admin/queue`.
 */
export const Route = createFileRoute('/_admin/admin/core/advanced/queue')({
  /**
   * The normalised parameters, not the raw search - which for this table
   * includes the status filter, so switching it is a different loader run and a
   * different cache entry rather than the same rows re-rendered.
   */
  loaderDeps: ({ search }) => ({ params: queueRouteParams(search) }),
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context, deps }) =>
    await loadAdminQueueRoute({ ...context, params: deps.params }),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  validateSearch: normalizeQueueRouteSearch,
  component: AdminQueueRoute,
  staticData: {
    breadcrumb: <AdminBreadcrumb segments={['core', 'advanced', 'queue']} />,
  },
})

function AdminQueueRoute() {
  return (
    <AdminQueueRouteContent
      {...Route.useLoaderData()}
      navigate={Route.useNavigate()}
      search={Route.useSearch()}
    />
  )
}
