import { createFileRoute } from '@tanstack/react-router'
import {
  AdminUserBreadcrumbContent,
  AdminUserRouteContent,
  loadAdminUserRoute,
} from '@vitnode/core/tanstack/admin/users'

import { pageHead } from '#/lib/page-head'
import { MigrationLink } from '#/migration/link'

/**
 * `/admin/core/users/123` - one user.
 *
 * The public URL is an ordinary one: a number in the path, no prefix, nothing
 * encoded. `$id` is only how the route tree spells "any segment here", and the
 * segment is turned into an id by `loadAdminUserRoute` - which answers
 * `notFound()` for anything that is not a decimal id, so `/admin/core/users/abc`
 * is a not-found screen rather than a request carrying `NaN`.
 *
 * That normalisation is deliberately *not* in `params.parse`. `parse` runs
 * inside `matchRoutes`, which `isTanStackOwnedPath` calls to decide whether this
 * application serves a path at all - so a `parse` that threw would take down
 * `MigrationLink` for every href it was asked about.
 *
 * The permissions (`users.can_view` to open it, `users.can_edit` and
 * `users.can_edit_admin` for the editors), the query, the namespaces, the title
 * and the whole page are `@vitnode/core/tanstack/admin/users`.
 */
export const Route = createFileRoute('/_admin/admin/core/users/$id')({
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context, params }) =>
    await loadAdminUserRoute({ ...context, id: params.id }),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  component: AdminUserRoute,
  staticData: {
    breadcrumb: <AdminUserBreadcrumbContent LinkComponent={MigrationLink} />,
  },
})

/**
 * `MigrationLink` because the page links out to `/profile/<nameCode>`, which the
 * Next.js application still serves.
 */
function AdminUserRoute() {
  return (
    <AdminUserRouteContent
      {...Route.useLoaderData()}
      LinkComponent={MigrationLink}
    />
  )
}
