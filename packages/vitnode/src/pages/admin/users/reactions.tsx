import type { PluginRoutePageProps } from "@/routing";
import type { AdminReactionsRouteData } from "@/tanstack/admin/reactions/route";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminReactionsRoute } from "@/tanstack/admin/reactions/route";
import { AdminReactionsRouteContent } from "@/tanstack/admin/reactions/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminReactionsPage = ({
  loaderData,
}: PluginRoutePageProps<AdminReactionsRouteData>) => (
  <AdminReactionsRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminReactionsRouteData>({
  load: async ({ context, t }) =>
    await loadAdminReactionsRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({
    segments: ["core", "users", "reactions"],
  }),
});

export default AdminReactionsPage;
