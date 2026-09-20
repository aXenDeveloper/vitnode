import type { PluginRoutePageProps } from "@/routing";
import type { AdminNavigationRouteData } from "@/tanstack/admin/navigation/route";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminNavigationRoute } from "@/tanstack/admin/navigation/route";
import { AdminNavigationRouteContent } from "@/tanstack/admin/navigation/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminNavigationPage = ({
  loaderData,
}: PluginRoutePageProps<AdminNavigationRouteData>) => (
  <AdminNavigationRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminNavigationRouteData>({
  load: async ({ context, t }) =>
    await loadAdminNavigationRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "system", "navigation"] }),
});

export default AdminNavigationPage;
