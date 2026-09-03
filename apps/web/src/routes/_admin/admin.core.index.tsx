import { createFileRoute } from '@tanstack/react-router'
import { adminBreadcrumb } from '@vitnode/core/tanstack/admin'
import {
  AdminDashboardRouteContent,
  loadAdminDashboardRoute,
} from '@vitnode/core/tanstack/admin/dashboard'
import { CardsPendingSkeleton } from '@vitnode/core/tanstack/pending'

export const Route = createFileRoute('/_admin/admin/core/')({
  loader: async ({ context }) => await loadAdminDashboardRoute(context),
  component: AdminDashboardRoute,
  pendingComponent: CardsPendingSkeleton,

  staticData: {
    breadcrumb: adminBreadcrumb({ segments: ['core'] }),
  },
})

function AdminDashboardRoute() {
  return <AdminDashboardRouteContent {...Route.useLoaderData()} />
}
