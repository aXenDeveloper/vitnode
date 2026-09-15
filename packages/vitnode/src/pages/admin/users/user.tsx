import type { PluginRoutePageProps } from "@/routing";
import type { AdminUserRouteData } from "@/tanstack/admin/users/detail-route";

import { AdminUserBreadcrumbContent } from "@/tanstack/admin/users/detail-breadcrumb";
import { loadAdminUserRoute } from "@/tanstack/admin/users/detail-route";
import { AdminUserRouteContent } from "@/tanstack/admin/users/detail-screen";
import {
  defineAdminRoute,
  routeBreadcrumbGroup,
} from "@/tanstack/plugin-routes";

const AdminUserPage = ({
  loaderData,
}: PluginRoutePageProps<AdminUserRouteData>) => (
  <AdminUserRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminUserRouteData>({
  // `head` after `load`, always.
  load: async ({ context, params, t }) =>
    await loadAdminUserRoute({ ...context, id: params.id, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: routeBreadcrumbGroup(function AdminUserBreadcrumb({ params }) {
    return <AdminUserBreadcrumbContent params={params} />;
  }),
});

export default AdminUserPage;
