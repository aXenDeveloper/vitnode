import type { PluginRoutePageProps } from "@/routing";
import type { AdminStaffRouteData } from "@/tanstack/admin/staff/route";
import type { StaffRouteSearch } from "@/tanstack/admin/staff/route-search";

import { AdminStaffBreadcrumbContent } from "@/tanstack/admin/staff/breadcrumbs";
import { loadAdminStaffRoute } from "@/tanstack/admin/staff/route";
import { staffRouteParams } from "@/tanstack/admin/staff/route-search";
import { AdminStaffRouteContent } from "@/tanstack/admin/staff/screen";
import {
  defineAdminRoute,
  routeBreadcrumbGroup,
} from "@/tanstack/plugin-routes";

const ModeratorsPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<AdminStaffRouteData, StaffRouteSearch>) => (
  <AdminStaffRouteContent {...loaderData} navigate={navigate} search={search} />
);

export const route = defineAdminRoute<AdminStaffRouteData, StaffRouteSearch>({
  // `head` after `load`, always.
  load: async ({ context, search, t }) =>
    await loadAdminStaffRoute({
      ...context,
      params: staffRouteParams(search),
      t,
      type: "moderator",
    }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: routeBreadcrumbGroup(function ModeratorsBreadcrumb() {
    return <AdminStaffBreadcrumbContent type="moderator" />;
  }),
});

export default ModeratorsPage;
