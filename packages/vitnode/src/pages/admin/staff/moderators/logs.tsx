import type { PluginRoutePageProps } from "@/routing";
import type { AdminStaffLogsRouteData } from "@/tanstack/admin/staff/logs-route";
import type { ActivityRouteSearch } from "@/views/activity-logs/activity-search";

import { AdminStaffLogsBreadcrumbContent } from "@/tanstack/admin/staff/breadcrumbs";
import { loadAdminStaffLogsRoute } from "@/tanstack/admin/staff/logs-route";
import { AdminStaffLogsRouteContent } from "@/tanstack/admin/staff/logs-screen";
import {
  defineAdminRoute,
  routeBreadcrumbGroup,
} from "@/tanstack/plugin-routes";

const ModeratorsLogsPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<AdminStaffLogsRouteData, ActivityRouteSearch>) => (
  <AdminStaffLogsRouteContent
    {...loaderData}
    navigate={navigate}
    search={search}
  />
);

export const route = defineAdminRoute<
  AdminStaffLogsRouteData,
  ActivityRouteSearch
>({
  // `head` after `load`, always.
  load: async ({ context, search, t }) =>
    await loadAdminStaffLogsRoute({ ...context, search, t, type: "moderator" }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: routeBreadcrumbGroup(function ModeratorsLogsBreadcrumb() {
    return <AdminStaffLogsBreadcrumbContent type="moderator" />;
  }),
});

export default ModeratorsLogsPage;
