import type { PluginRoutePageProps } from "@/routing";
import type { AdminSiteStatusRouteData } from "@/tanstack/admin/site-status/route";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminSiteStatusRoute } from "@/tanstack/admin/site-status/route";
import { AdminSiteStatusRouteContent } from "@/tanstack/admin/site-status/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminSiteStatusPage = ({
  loaderData,
}: PluginRoutePageProps<AdminSiteStatusRouteData>) => (
  <AdminSiteStatusRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminSiteStatusRouteData>({
  // `head` after `load`, always.
  load: async ({ context, t }) =>
    await loadAdminSiteStatusRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "system", "site-status"] }),
});

export default AdminSiteStatusPage;
