import type { PluginRoutePageProps } from "@/routing";
import type { AdminWarningsRouteData } from "@/tanstack/admin/warnings/route";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminWarningsLayout } from "@/tanstack/admin/warnings/route";
import { AdminWarningsLayoutContent } from "@/tanstack/admin/warnings/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminWarningsLayout = ({
  children,
  loaderData,
}: PluginRoutePageProps<AdminWarningsRouteData> & {
  children: React.ReactNode;
}) => (
  <AdminWarningsLayoutContent {...loaderData}>
    {children}
  </AdminWarningsLayoutContent>
);

export const route = defineAdminRoute<AdminWarningsRouteData>({
  load: async ({ context, t }) =>
    await loadAdminWarningsLayout({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({
    segments: ["core", "moderation", "warnings"],
  }),
});

export default AdminWarningsLayout;
