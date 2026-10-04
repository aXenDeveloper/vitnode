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

/**
 * The heading's strings come from the loader, so the `<h1>` and the `<title>`
 * are the same string by construction.
 */
export const route = defineAdminRoute<AdminNotificationsRouteData>({
  // `head` after `load`, always.
  load: async ({ context, t }) =>
    await loadAdminNotificationsRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({
    segments: ["core", "system", "notifications"],
  }),
});

export default AdminNotificationsPage;
