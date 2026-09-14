import type { PluginRoutePageProps } from "@/routing";
import type { AdminSearchIndexRouteData } from "@/tanstack/admin/search-index/route";
import type { SearchIndexRouteSearch } from "@/tanstack/admin/search-index/route-search";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminSearchIndexRoute } from "@/tanstack/admin/search-index/route";
import { AdminSearchIndexRouteContent } from "@/tanstack/admin/search-index/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminSearchIndexPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<AdminSearchIndexRouteData, SearchIndexRouteSearch>) => (
  <AdminSearchIndexRouteContent
    {...loaderData}
    navigate={navigate}
    search={search}
  />
);

export const route = defineAdminRoute<
  AdminSearchIndexRouteData,
  SearchIndexRouteSearch
>({
  // `head` after `load`, always.
  load: async ({ context, t }) =>
    await loadAdminSearchIndexRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "advanced", "search"] }),
});

export default AdminSearchIndexPage;
