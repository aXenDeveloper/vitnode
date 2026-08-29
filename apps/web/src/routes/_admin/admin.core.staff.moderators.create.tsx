import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  AdminStaffCreateBreadcrumbContent,
  AdminStaffCreateRouteContent,
  loadAdminStaffCreateRoute,
} from '@vitnode/core/tanstack/admin/staff'

import { pageHead } from '#/lib/page-head'
import { MigrationLink } from '#/migration/link'

/**
 * `/admin/core/staff/moderators/create` - adding a role or a user to the moderators
 * group.
 *
 * The permission (`staff_moderators.can_create`), the two pickers, the write and
 * where a created entry is opened all live in
 * `@vitnode/core/tanstack/admin/staff`. What stays here is topology and
 * `navigate`, which TanStack can only give a route.
 *
 * A created entry grants nothing until its permissions are chosen, so a
 * successful create goes to the edit screen rather than back to the list -
 * landing on the list would look like the create had silently done nothing.
 */
export const Route = createFileRoute(
  '/_admin/admin/core/staff/moderators/create',
)({
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context }) =>
    await loadAdminStaffCreateRoute({ ...context, type: 'moderator' }),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  component: AdminStaffCreateRoute,
  staticData: {
    breadcrumb: (
      <AdminStaffCreateBreadcrumbContent
        LinkComponent={MigrationLink}
        type="moderator"
      />
    ),
  },
})

/**
 * `navigate` is the router's, taking an href the package built: the destination
 * is `staffEditHref(type, id)`, which is VitNode's URL shape rather than this
 * application's, so the package decides *where* and the route performs it.
 */
function AdminStaffCreateRoute() {
  const router = useRouter()

  return (
    <AdminStaffCreateRouteContent
      {...Route.useLoaderData()}
      LinkComponent={MigrationLink}
      navigate={async (href) => {
        await router.navigate({ to: href })
      }}
    />
  )
}
