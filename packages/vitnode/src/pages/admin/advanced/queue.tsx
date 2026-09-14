import type { PluginRoutePageProps } from "@/routing";
import type { AdminQueueRouteData } from "@/tanstack/admin/queue/route";
import type { QueueRouteSearch } from "@/tanstack/admin/queue/route-search";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminQueueRoute } from "@/tanstack/admin/queue/route";
import { queueRouteParams } from "@/tanstack/admin/queue/route-search";
import { AdminQueueRouteContent } from "@/tanstack/admin/queue/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminQueuePage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<AdminQueueRouteData, QueueRouteSearch>) => (
  <AdminQueueRouteContent {...loaderData} navigate={navigate} search={search} />
);

export const route = defineAdminRoute<AdminQueueRouteData, QueueRouteSearch>({
  // `head` after `load`, always.
  load: async ({ context, search, t }) =>
    await loadAdminQueueRoute({
      ...context,
      params: queueRouteParams(search),
      t,
    }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "advanced", "queue"] }),
});

export default AdminQueuePage;
