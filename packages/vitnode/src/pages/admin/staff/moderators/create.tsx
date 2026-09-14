import type { PluginRoutePageProps } from "@/routing";
import type { AdminStaffCreateRouteData } from "@/tanstack/admin/staff/create-route";

import { AdminStaffBreadcrumbContent } from "@/tanstack/admin/staff/breadcrumbs";
import { loadAdminStaffCreateRoute } from "@/tanstack/admin/staff/create-route";
import { AdminStaffCreateRouteContent } from "@/tanstack/admin/staff/create-screen";
import { useStaffFormNavigate } from "@/tanstack/admin/staff/navigation";
import {
  defineAdminRoute,
  routeBreadcrumbGroup,
} from "@/tanstack/plugin-routes";

const ModeratorsCreatePage = ({
  loaderData,
}: PluginRoutePageProps<AdminStaffCreateRouteData>) => (
  <AdminStaffCreateRouteContent
    {...loaderData}
    navigate={useStaffFormNavigate()}
  />
);

export const route = defineAdminRoute<AdminStaffCreateRouteData>({
  // `head` after `load`, always.
  load: async ({ context, t }) =>
    await loadAdminStaffCreateRoute({ ...context, t, type: "moderator" }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: routeBreadcrumbGroup(function ModeratorsCreateBreadcrumb() {
    return <AdminStaffBreadcrumbContent type="moderator" />;
  }),
});

export default ModeratorsCreatePage;
