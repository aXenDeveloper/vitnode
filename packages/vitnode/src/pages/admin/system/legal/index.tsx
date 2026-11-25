import type { PluginRoutePageProps } from "@/routing";
import type { AdminLegalRouteData } from "@/tanstack/admin/legal/route";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminLegalRoute } from "@/tanstack/admin/legal/route";
import { AdminLegalRouteContent } from "@/tanstack/admin/legal/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminLegalPage = ({
  loaderData,
}: PluginRoutePageProps<AdminLegalRouteData>) => (
  <AdminLegalRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminLegalRouteData>({
  load: async ({ context, t }) => await loadAdminLegalRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "system", "legal"] }),
});

export default AdminLegalPage;
