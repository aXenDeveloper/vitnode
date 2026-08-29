import { createFileRoute } from '@tanstack/react-router'
import {
  AdminStaffBreadcrumbContent,
  AdminStaffRouteContent,
  loadAdminStaffRoute,
  normalizeStaffRouteSearch,
  staffRouteParams,
} from '@vitnode/core/tanstack/admin/staff'

import { pageHead } from '#/lib/page-head'
import { MigrationLink } from '#/migration/link'

/**
 * `/admin/core/staff/moderators` - the AdminCP moderators list.
 *
 * The twin of `admin.core.staff.admins.index.tsx`, and deliberately so: the two
 * lists are one screen over two API endpoints, so both route files declare the
 * same loader and the same component with `type` set differently. Everything
 * that could differ between them - the endpoint, the permission module
 * (`staff_moderators`) and the strings - is derived from that one value inside
 * `@vitnode/core/tanstack/admin/staff`.
 *
 * The breadcrumb is a component rather than `<AdminBreadcrumb segments={...}>`
 * because two of its crumbs are not in the sidebar under the spellings the page
 * uses: `/admin/core/staff` is a nav *group* with no page of its own. It names
 * them explicitly, from the same helper the Next.js `@breadcrumb` slot uses.
 *
 * The Next.js route at `packages/vitnode/src/routes/admin/core/staff/moderators` is
 * still live and unchanged.
 */
export const Route = createFileRoute('/_admin/admin/core/staff/moderators/')({
  loaderDeps: ({ search }) => ({ params: staffRouteParams(search) }),
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context, deps }) =>
    await loadAdminStaffRoute({
      ...context,
      params: deps.params,
      type: 'moderator',
    }),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  validateSearch: normalizeStaffRouteSearch,
  component: AdminStaffRoute,
  staticData: {
    breadcrumb: (
      <AdminStaffBreadcrumbContent
        LinkComponent={MigrationLink}
        type="moderator"
      />
    ),
  },
})

function AdminStaffRoute() {
  return (
    <AdminStaffRouteContent
      {...Route.useLoaderData()}
      LinkComponent={MigrationLink}
      navigate={Route.useNavigate()}
      search={Route.useSearch()}
    />
  )
}
