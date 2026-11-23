import type { PluginRoutePageProps } from "@/routing";
import type { AdminSeoRouteData } from "@/tanstack/admin/seo/route";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminSeoRoute } from "@/tanstack/admin/seo/route";
import { AdminSeoRouteContent } from "@/tanstack/admin/seo/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminSeoPage = ({
  loaderData,
}: PluginRoutePageProps<AdminSeoRouteData>) => (
  <AdminSeoRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminSeoRouteData>({
  // `head` after `load`, always.
  load: async ({ context, t }) => await loadAdminSeoRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "system", "seo"] }),
});

export default AdminSeoPage;
