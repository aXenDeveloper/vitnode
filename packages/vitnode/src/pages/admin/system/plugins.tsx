import type { PluginRoutePageProps } from "@/routing";
import type { AdminPluginsRouteData } from "@/tanstack/admin/plugins/route";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminPluginsRoute } from "@/tanstack/admin/plugins/route";
import { AdminPluginsRouteContent } from "@/tanstack/admin/plugins/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminPluginsPage = ({
  loaderData,
}: PluginRoutePageProps<AdminPluginsRouteData>) => (
  <AdminPluginsRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminPluginsRouteData>({
  // `head` after `load`, always.
  load: async ({ context, t }) =>
    await loadAdminPluginsRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "system", "plugins"] }),
});

export default AdminPluginsPage;
