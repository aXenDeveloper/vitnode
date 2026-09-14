import type { PluginRoutePageProps } from "@/routing";
import type { AdminStaffEditRouteData } from "@/tanstack/admin/staff/edit-route";

import { AdminStaffBreadcrumbContent } from "@/tanstack/admin/staff/breadcrumbs";
import { loadAdminStaffEditRoute } from "@/tanstack/admin/staff/edit-route";
import { AdminStaffEditRouteContent } from "@/tanstack/admin/staff/edit-screen";
import { useStaffFormNavigate } from "@/tanstack/admin/staff/navigation";
import {
  defineAdminRoute,
  routeBreadcrumbGroup,
} from "@/tanstack/plugin-routes";

const AdminsEditPage = ({
  loaderData,
}: PluginRoutePageProps<AdminStaffEditRouteData>) => (
  <AdminStaffEditRouteContent
    {...loaderData}
    navigate={useStaffFormNavigate()}
  />
);

export const route = defineAdminRoute<AdminStaffEditRouteData>({
  // `head` after `load`, always.
  load: async ({ context, params, t }) =>
    await loadAdminStaffEditRoute({
      ...context,
      id: params.id,
      t,
      type: "admin",
    }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: routeBreadcrumbGroup(function AdminsEditBreadcrumb() {
    return <AdminStaffBreadcrumbContent type="admin" />;
  }),
});

export default AdminsEditPage;
