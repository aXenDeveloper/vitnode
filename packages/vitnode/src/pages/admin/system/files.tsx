import type { PluginRoutePageProps } from "@/routing";
import type { AdminFilesRouteData } from "@/tanstack/admin/files/route";
import type { AdminFilesRouteSearch } from "@/tanstack/admin/files/route-search";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminFilesRoute } from "@/tanstack/admin/files/route";
import { adminFilesRouteParams } from "@/tanstack/admin/files/route-search";
import { AdminFilesRouteContent } from "@/tanstack/admin/files/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminFilesPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<AdminFilesRouteData, AdminFilesRouteSearch>) => (
  <AdminFilesRouteContent {...loaderData} navigate={navigate} search={search} />
);

export const route = defineAdminRoute<
  AdminFilesRouteData,
  AdminFilesRouteSearch
>({
  // `head` after `load`, always.
  load: async ({ context, search, t }) =>
    await loadAdminFilesRoute({
      ...context,
      params: adminFilesRouteParams(search),
      t,
    }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "system", "files"] }),
});

export default AdminFilesPage;
