import type { PluginRoutePageProps } from "@/routing";
import type { AdminPaymentRouteData } from "@/tanstack/admin/payments/route";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminPaymentRoute } from "@/tanstack/admin/payments/route";
import { AdminPaymentRouteContent } from "@/tanstack/admin/payments/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminPaymentPage = ({
  loaderData,
}: PluginRoutePageProps<AdminPaymentRouteData>) => (
  <AdminPaymentRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminPaymentRouteData>({
  // `head` after `load`, always.
  load: async ({ context, params, t }) =>
    await loadAdminPaymentRoute({ ...context, params: { id: params.id }, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "payments"] }),
});

export default AdminPaymentPage;
