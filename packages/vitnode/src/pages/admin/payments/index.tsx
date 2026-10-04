import type { PluginRoutePageProps } from "@/routing";
import type { AdminPaymentsRouteData } from "@/tanstack/admin/payments/route";
import type { PaymentsTableRouteSearch } from "@/tanstack/admin/payments/route-search";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminPaymentsRoute } from "@/tanstack/admin/payments/route";
import { purchasesRouteParams } from "@/tanstack/admin/payments/route-search";
import { AdminPaymentsRouteContent } from "@/tanstack/admin/payments/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminPaymentsPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<AdminPaymentsRouteData, PaymentsTableRouteSearch>) => (
  <AdminPaymentsRouteContent
    {...loaderData}
    navigate={navigate}
    search={search as Record<string, unknown>}
  />
);

export const route = defineAdminRoute<
  AdminPaymentsRouteData,
  PaymentsTableRouteSearch
>({
  // `head` after `load`, always.
  load: async ({ context, search, t }) =>
    await loadAdminPaymentsRoute({
      ...context,
      params: purchasesRouteParams(search as Record<string, unknown>),
      t,
    }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "payments"] }),
});

export default AdminPaymentsPage;
