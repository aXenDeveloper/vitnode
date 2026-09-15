import type { PluginRoutePageProps } from "@/routing";
import type { AdminRolesRouteData } from "@/tanstack/admin/roles/route";
import type { RolesRouteSearch } from "@/tanstack/admin/roles/route-search";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminRolesRoute } from "@/tanstack/admin/roles/route";
import { rolesRouteParams } from "@/tanstack/admin/roles/route-search";
import { AdminRolesRouteContent } from "@/tanstack/admin/roles/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminRolesPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<AdminRolesRouteData, RolesRouteSearch>) => (
  <AdminRolesRouteContent {...loaderData} navigate={navigate} search={search} />
);

export const route = defineAdminRoute<AdminRolesRouteData, RolesRouteSearch>({
  // `head` after `load`, always.
  load: async ({ context, search, t }) =>
    await loadAdminRolesRoute({
      ...context,
      params: rolesRouteParams(search),
      t,
    }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "users", "roles"] }),
});

export default AdminRolesPage;
