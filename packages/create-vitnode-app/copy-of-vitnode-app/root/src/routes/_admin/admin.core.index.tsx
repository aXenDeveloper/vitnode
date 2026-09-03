import { createFileRoute } from "@tanstack/react-router";
import { AdminBreadcrumb } from "@vitnode/core/tanstack/admin";
import {
  AdminDashboardRouteContent,
  loadAdminDashboardRoute,
} from "@vitnode/core/tanstack/admin/dashboard";


export const Route = createFileRoute("/_admin/admin/core/")({
  loader: async ({ context }) => await loadAdminDashboardRoute(context),
  component: AdminDashboardRoute,
  
  staticData: {
    breadcrumb: <AdminBreadcrumb segments={["core"]} />,
  },
});

function AdminDashboardRoute() {
  return <AdminDashboardRouteContent {...Route.useLoaderData()} />;
}
