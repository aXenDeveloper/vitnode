import { createFileRoute } from '@tanstack/react-router'
import {
  AdminUserBreadcrumbContent,
  AdminUserRouteContent,
  loadAdminUserRoute,
} from '@vitnode/core/tanstack/admin/users'
import { RouterLink } from '@vitnode/core/tanstack/layout'

import { pageHead } from '#/lib/page-head'

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
 * inside `matchRoutes`, which the router calls on every navigation and every
 * `<Link>` it builds - so a `parse` that threw would take down far more than the
 * one screen with a bad id in its URL.
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
    breadcrumb: <AdminUserBreadcrumbContent />,
  },
})

/**
 * The screen takes the link as a required prop - it links out to
 * `/profile/<nameCode>` - and the shared views below it may not import a router
 * themselves, so the host supplies core's own `RouterLink`.
 */
function AdminUserRoute() {
  return (
    <AdminUserRouteContent
      {...Route.useLoaderData()}
      LinkComponent={RouterLink}
    />
  )
}
