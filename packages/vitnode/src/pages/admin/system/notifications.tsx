import type { PluginRoutePageProps } from "@/routing";
import type { AdminNotificationsRouteData } from "@/tanstack/admin/notifications/route";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminNotificationsRoute } from "@/tanstack/admin/notifications/route";
import { AdminNotificationsRouteContent } from "@/tanstack/admin/notifications/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminNotificationsPage = ({
  loaderData,
}: PluginRoutePageProps<AdminNotificationsRouteData>) => (
  <AdminNotificationsRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminNotificationsRouteData>({
  load: async ({ context, t }) =>
    await loadAdminNotificationsRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({
    segments: ["core", "system", "notifications"],
  }),
});

export default AdminNotificationsPage;
