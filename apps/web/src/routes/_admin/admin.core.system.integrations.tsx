import { createFileRoute } from '@tanstack/react-router'
import { AdminBreadcrumb } from '@vitnode/core/tanstack/admin'
import {
  AdminIntegrationsRouteContent,
  loadAdminIntegrationsRoute,
} from '@vitnode/core/tanstack/admin/integrations'

import { pageHead } from '#/lib/page-head'

/**
 * `/admin/core/system/integrations` - the integrations board.
 *
 * Topology only, and the least of it: this screen has no search parameters, so
 * there is no `validateSearch` and no `loaderDeps` - the loader runs once per
 * navigation. The query, the permission (`system.can_view`, plus
 * `system.can_test_ai` / `can_test_storage` / `can_send_test_email` for the
 * three test buttons), the namespaces, the title and the nine cards are
 * `@vitnode/core/tanstack/admin/integrations`.
 */
export const Route = createFileRoute('/_admin/admin/core/system/integrations')({
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context }) => await loadAdminIntegrationsRoute(context),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  component: AdminIntegrationsRoute,
  staticData: {
    breadcrumb: (
      <AdminBreadcrumb segments={['core', 'system', 'integrations']} />
    ),
  },
})

/**
 * The heading's strings come from the loader, so the `<h1>` and the `<title>`
 * are the same string by construction. `component` is passed no props, which is
 * why this wrapper exists at all.
 */
function AdminIntegrationsRoute() {
  return <AdminIntegrationsRouteContent {...Route.useLoaderData()} />
}
