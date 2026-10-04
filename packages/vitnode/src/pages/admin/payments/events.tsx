import type { PluginRoutePageProps } from "@/routing";
import type { AdminWebhookEventsRouteData } from "@/tanstack/admin/payments/route";
import type { AdminTableRouteSearch } from "@/tanstack/admin/table-search";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminWebhookEventsRoute } from "@/tanstack/admin/payments/route";
import { eventsRouteParams } from "@/tanstack/admin/payments/route-search";
import { AdminWebhookEventsRouteContent } from "@/tanstack/admin/payments/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminWebhookEventsPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<
  AdminWebhookEventsRouteData,
  AdminTableRouteSearch
>) => (
  <AdminWebhookEventsRouteContent
    {...loaderData}
    navigate={navigate}
    search={search as Record<string, unknown>}
  />
);

export const route = defineAdminRoute<
  AdminWebhookEventsRouteData,
  AdminTableRouteSearch
>({
  // `head` after `load`, always.
  load: async ({ context, search, t }) =>
    await loadAdminWebhookEventsRoute({
      ...context,
      params: eventsRouteParams(search as Record<string, unknown>),
      t,
    }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "payments", "events"] }),
});

export default AdminWebhookEventsPage;
