import { createFileRoute } from '@tanstack/react-router'
import { AdminBreadcrumb } from '@vitnode/core/tanstack/admin'
import {
  AdminFilesRouteContent,
  adminFilesRouteParams,
  loadAdminFilesRoute,
  normalizeAdminFilesRouteSearch,
} from '@vitnode/core/tanstack/admin/files'

import { pageHead } from '#/lib/page-head'

/**
 * `/admin/core/system/files` - every file uploaded to the installation.
 *
 * Topology only. The query, the three permissions (`files.can_view` to open it,
 * `files.can_download` and `files.can_delete` for the row controls), the
 * namespaces, the title, the search box and both deletes are
 * `@vitnode/core/tanstack/admin/files`.
 *
 * Not to be confused with `/files` under `_main/_authenticated`, which is the
 * *visitor's own* files: a different endpoint, a different permission and a
 * different cache family.
 */
export const Route = createFileRoute('/_admin/admin/core/system/files')({
  /** The normalised parameters - this table's search term included. */
  loaderDeps: ({ search }) => ({ params: adminFilesRouteParams(search) }),
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context, deps }) =>
    await loadAdminFilesRoute({ ...context, params: deps.params }),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  validateSearch: normalizeAdminFilesRouteSearch,
  component: AdminFilesRoute,
  staticData: {
    breadcrumb: <AdminBreadcrumb segments={['core', 'system', 'files']} />,
  },
})

function AdminFilesRoute() {
  return (
    <AdminFilesRouteContent
      {...Route.useLoaderData()}
      navigate={Route.useNavigate()}
      search={Route.useSearch()}
    />
  )
}
