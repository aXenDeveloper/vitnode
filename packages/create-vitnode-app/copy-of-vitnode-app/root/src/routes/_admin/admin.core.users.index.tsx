import { createFileRoute } from '@tanstack/react-router'
import { AdminBreadcrumb } from '@vitnode/core/tanstack/admin'
import {
  AdminUsersRouteContent,
  loadAdminUsersRoute,
  normalizeUsersRouteSearch,
  usersRouteParams,
} from '@vitnode/core/tanstack/admin/users'
import { RouterLink } from '@vitnode/core/tanstack/layout'

import { pageHead } from '#/lib/page-head'

/**
 * `/admin/core/users` - the AdminCP users list.
 *
 * Topology, and the four things TanStack types from the path itself: the search
 * contract, `navigate`, the crumb this route contributes, and which application
 * renders a link out of it. The query, the permissions (`users.can_view` to
 * open it, `users.can_create` for the button, `users.can_edit` for the rows),
 * the namespaces, the title, the table and the role filter's lookup are all
 * `@vitnode/core/tanstack/admin/users`.
 *
 * `RouterLink` is passed rather than defaulted because the screen lives in
 * `tanstack/admin/users`, which takes the link as a required prop: a row's
 * pencil points at `/admin/core/users/123`, and the shared table below it is
 * host-neutral and may not import a router itself.
 *
 * No locale prefix, in any language: `DEFAULT_IGNORED_LOCALE_PATHS` lists
 * `/admin` with its descendants, so the rewrite neither strips one nor writes
 * one. `robots` is `_admin`'s.
 */
export const Route = createFileRoute('/_admin/admin/core/users/')({
  /**
   * The request, as the only thing the loader re-runs for.
   *
   * The *normalised* parameters rather than the raw search: the router hands
   * `loaderDeps` the validated search merged over everything else that was in
   * the query string, so keying on it directly would re-run the loader for a
   * stray `?utm_source=` - and would treat `?first=10` and no `first` as two
   * different pages of the same rows.
   */
  loaderDeps: ({ search }) => ({ params: usersRouteParams(search) }),
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context, deps }) =>
    await loadAdminUsersRoute({ ...context, params: deps.params }),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  validateSearch: normalizeUsersRouteSearch,
  component: AdminUsersRoute,
  staticData: {
    breadcrumb: <AdminBreadcrumb segments={['core', 'users']} />,
  },
})

/**
 * `navigate` and `search` are handed down because TanStack infers both from the
 * path above, which is why they cannot come from the package.
 */
function AdminUsersRoute() {
  return (
    <AdminUsersRouteContent
      {...Route.useLoaderData()}
      LinkComponent={RouterLink}
      navigate={Route.useNavigate()}
      search={Route.useSearch()}
    />
  )
}
