import type { PluginRoutePageProps } from "@/routing";
import type { AdminAiHistoryRouteData } from "@/tanstack/admin/ai/route";
import type { AiHistoryRouteSearch } from "@/tanstack/admin/ai/route-search";

import { AdminAiHistoryRouteContent } from "@/tanstack/admin/ai/history-screen";
import { loadAdminAiHistoryRoute } from "@/tanstack/admin/ai/route";
import { aiHistoryRouteParams } from "@/tanstack/admin/ai/route-search";
import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminAiHistoryPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<AdminAiHistoryRouteData, AiHistoryRouteSearch>) => (
  <AdminAiHistoryRouteContent
    {...loaderData}
    navigate={navigate}
    search={search}
  />
);

export const route = defineAdminRoute<
  AdminAiHistoryRouteData,
  AiHistoryRouteSearch
>({
  // `head` after `load`, always.
  load: async ({ context, search, t }) =>
    await loadAdminAiHistoryRoute({
      ...context,
      params: aiHistoryRouteParams(search),
      t,
    }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "ai", "history"] }),
});

export default AdminAiHistoryPage;
