import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  AdminStaffEditBreadcrumbContent,
  AdminStaffEditRouteContent,
  loadAdminStaffEditRoute,
} from '@vitnode/core/tanstack/admin/staff'
import { RouterLink } from '@vitnode/core/tanstack/layout'

import { pageHead } from '#/lib/page-head'

/**
 * `/admin/core/staff/admins/edit/12` - what one staff entry may do.
 *
 * The public URL is an ordinary one; `$id` is only how the route tree spells
 * "any segment here". `loadAdminStaffEditRoute` turns it into an entry id and
 * answers `notFound()` for anything that is not one, so
 * `/admin/core/staff/admins/edit/abc` is a not-found screen rather than a request
 * carrying `NaN`. That normalisation is deliberately not in `params.parse` -
 * see `admin.core.users.$id.tsx` for why.
 *
 * The permission (`staff_admins.can_edit`), the catalog, the dependency rules,
 * the labels and the save are `@vitnode/core/tanstack/admin/staff`.
 */
export const Route = createFileRoute(
  '/_admin/admin/core/staff/admins/edit/$id',
)({
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context, params }) =>
    await loadAdminStaffEditRoute({
      ...context,
      id: params.id,
      type: 'admin',
    }),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  component: AdminStaffEditRoute,
  staticData: {
    breadcrumb: <AdminStaffEditBreadcrumbContent type="admin" />,
  },
})

function AdminStaffEditRoute() {
  const router = useRouter()

  return (
    <AdminStaffEditRouteContent
      {...Route.useLoaderData()}
      LinkComponent={RouterLink}
      navigate={async (href) => {
        await router.navigate({ to: href })
      }}
    />
  )
}
