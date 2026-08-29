import { createFileRoute } from '@tanstack/react-router'
import { AdminBreadcrumb } from '@vitnode/core/tanstack/admin'
import {
  AdminRolesRouteContent,
  loadAdminRolesRoute,
  normalizeRolesRouteSearch,
  rolesRouteParams,
} from '@vitnode/core/tanstack/admin/roles'

import { pageHead } from '#/lib/page-head'
import { MigrationLink } from '#/migration/link'

/**
 * `/admin/core/users/roles` - the AdminCP roles list.
 *
 * A sibling of `users/$id` rather than a child of it: `roles` is a static
 * segment and TanStack ranks those above dynamic ones, so `/admin/core/users/roles`
 * matches this route and never `$id`. `src/tests/admin-routes.test.ts` pins it.
 *
 * The query, the six permissions the row actions apply, the namespaces, the
 * title, the table and both dialogs are `@vitnode/core/tanstack/admin/roles`.
 * The Next.js route at `packages/vitnode/src/routes/admin/core/users/roles` is
 * still live and unchanged.
 */
export const Route = createFileRoute('/_admin/admin/core/users/roles')({
  loaderDeps: ({ search }) => ({ params: rolesRouteParams(search) }),
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context, deps }) =>
    await loadAdminRolesRoute({ ...context, params: deps.params }),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  validateSearch: normalizeRolesRouteSearch,
  component: AdminRolesRoute,
  staticData: {
    breadcrumb: <AdminBreadcrumb segments={['core', 'users', 'roles']} />,
  },
})

/**
 * `MigrationLink` because the members count links to
 * `/admin/core/users?roleId=<id>` - a route this application owns, and one whose
 * query string has to survive the hop.
 */
function AdminRolesRoute() {
  return (
    <AdminRolesRouteContent
      {...Route.useLoaderData()}
      LinkComponent={MigrationLink}
      navigate={Route.useNavigate()}
      search={Route.useSearch()}
    />
  )
}
