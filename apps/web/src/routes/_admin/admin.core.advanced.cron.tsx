import { createFileRoute } from '@tanstack/react-router'
import { AdminBreadcrumb } from '@vitnode/core/tanstack/admin'
import {
  AdminCronRouteContent,
  cronRouteParams,
  loadAdminCronRoute,
  normalizeCronRouteSearch,
} from '@vitnode/core/tanstack/admin/cron'

import { pageHead } from '#/lib/page-head'

/**
 * `/admin/core/advanced/cron` - the cron list.
 *
 * Topology, and the three things TanStack types from the path itself: the search
 * contract, `navigate`, and the crumb this route contributes. The query, the
 * permission (`cron.can_view`), the namespaces, the title and the table are all
 * `@vitnode/core/tanstack/admin/cron`.
 *
 * The Next.js route at `packages/vitnode/src/routes/admin/core/advanced/cron`
 * is still live and unchanged - both render `CronTableContent` over the request
 * built by the same `cronRequest`, so a sorted URL means the same thing in
 * either application until the cutover.
 *
 * No locale prefix, in any language: `DEFAULT_IGNORED_LOCALE_PATHS` lists
 * `/admin` with its descendants, so the rewrite neither strips one nor writes
 * one. Nothing in this file mentions a language, and `robots` is `_admin`'s.
 */
export const Route = createFileRoute('/_admin/admin/core/advanced/cron')({
  /**
   * The request, as the only thing the loader re-runs for.
   *
   * The *normalised* parameters rather than the raw search. The router hands
   * `loaderDeps` the validated search merged over everything else that was in
   * the query string, so keying on it directly would re-run the loader for a
   * stray `?utm_source=` - and, worse, would treat `?first=10` and no `first` as
   * two different pages of the same rows.
   */
  loaderDeps: ({ search }) => ({ params: cronRouteParams(search) }),
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context, deps }) =>
    await loadAdminCronRoute({ ...context, params: deps.params }),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  validateSearch: normalizeCronRouteSearch,
  component: AdminCronRoute,
  staticData: {
    breadcrumb: <AdminBreadcrumb segments={['core', 'advanced', 'cron']} />,
  },
})

/**
 * `navigate` and `search` are handed down because TanStack infers both from the
 * path above, which is why they cannot come from the package.
 */
function AdminCronRoute() {
  return (
    <AdminCronRouteContent
      {...Route.useLoaderData()}
      navigate={Route.useNavigate()}
      search={Route.useSearch()}
    />
  )
}
