import type { PluginRoutePageProps } from "@/routing";
import type { AdminAiOverviewRouteData } from "@/tanstack/admin/ai/route";
import type { AiOverviewRouteSearch } from "@/tanstack/admin/ai/route-search";

import { AdminAiOverviewRouteContent } from "@/tanstack/admin/ai/overview-screen";
import { loadAdminAiOverviewRoute } from "@/tanstack/admin/ai/route";
import { aiOverviewPeriodOf } from "@/tanstack/admin/ai/route-search";
import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminAiOverviewPage = ({
  loaderData,
  navigate,
}: PluginRoutePageProps<AdminAiOverviewRouteData, AiOverviewRouteSearch>) => (
  <AdminAiOverviewRouteContent {...loaderData} navigate={navigate} />
);

export const route = defineAdminRoute<
  AdminAiOverviewRouteData,
  AiOverviewRouteSearch
>({
  // `head` after `load`, always.
  load: async ({ context, search, t }) =>
    await loadAdminAiOverviewRoute({
      ...context,
      period: aiOverviewPeriodOf(search),
      t,
    }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "ai"] }),
});

export default AdminAiOverviewPage;
