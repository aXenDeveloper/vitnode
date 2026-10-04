import type { PluginRoutePageProps } from "@/routing";
import type { AdminSubscriptionsRouteData } from "@/tanstack/admin/payments/route";
import type { PaymentsTableRouteSearch } from "@/tanstack/admin/payments/route-search";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminSubscriptionsRoute } from "@/tanstack/admin/payments/route";
import { subscriptionsRouteParams } from "@/tanstack/admin/payments/route-search";
import { AdminSubscriptionsRouteContent } from "@/tanstack/admin/payments/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminSubscriptionsPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<
  AdminSubscriptionsRouteData,
  PaymentsTableRouteSearch
>) => (
  <AdminSubscriptionsRouteContent
    {...loaderData}
    navigate={navigate}
    search={search as Record<string, unknown>}
  />
);

export const route = defineAdminRoute<
  AdminSubscriptionsRouteData,
  PaymentsTableRouteSearch
>({
  // `head` after `load`, always.
  load: async ({ context, search, t }) =>
    await loadAdminSubscriptionsRoute({
      ...context,
      params: subscriptionsRouteParams(search as Record<string, unknown>),
      t,
    }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({
    segments: ["core", "payments", "subscriptions"],
  }),
});

export default AdminSubscriptionsPage;
