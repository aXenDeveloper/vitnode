import type { PluginRoutePageProps } from "@/routing";
import type { AdminCronRouteData } from "@/tanstack/admin/cron/route";
import type { CronRouteSearch } from "@/tanstack/admin/cron/route-search";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminCronRoute } from "@/tanstack/admin/cron/route";
import { cronRouteParams } from "@/tanstack/admin/cron/route-search";
import { AdminCronRouteContent } from "@/tanstack/admin/cron/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminCronPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<AdminCronRouteData, CronRouteSearch>) => (
  <AdminCronRouteContent {...loaderData} navigate={navigate} search={search} />
);

export const route = defineAdminRoute<AdminCronRouteData, CronRouteSearch>({
  // `head` after `load`, always.
  load: async ({ context, search, t }) =>
    await loadAdminCronRoute({
      ...context,
      params: cronRouteParams(search),
      t,
    }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "advanced", "cron"] }),
});

export default AdminCronPage;
