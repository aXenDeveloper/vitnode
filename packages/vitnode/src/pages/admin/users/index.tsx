import type { PluginRoutePageProps } from "@/routing";
import type { AdminUsersRouteData } from "@/tanstack/admin/users/route";
import type { UsersRouteSearch } from "@/tanstack/admin/users/route-search";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminUsersRoute } from "@/tanstack/admin/users/route";
import { usersRouteParams } from "@/tanstack/admin/users/route-search";
import { AdminUsersRouteContent } from "@/tanstack/admin/users/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminUsersPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<AdminUsersRouteData, UsersRouteSearch>) => (
  <AdminUsersRouteContent {...loaderData} navigate={navigate} search={search} />
);

export const route = defineAdminRoute<AdminUsersRouteData, UsersRouteSearch>({
  // `head` after `load`, always.
  load: async ({ context, search, t }) =>
    await loadAdminUsersRoute({
      ...context,
      params: usersRouteParams(search),
      t,
    }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "users"] }),
});

export default AdminUsersPage;
