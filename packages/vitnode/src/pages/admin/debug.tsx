import type { PluginRoutePageProps } from "@/routing";
import type { AdminDebugRouteData } from "@/tanstack/admin/debug/route";
import type { DebugRouteSearch } from "@/tanstack/admin/debug/route-search";

import { loadAdminDebugRoute } from "@/tanstack/admin/debug/route";
import { debugLogsRouteParams } from "@/tanstack/admin/debug/route-search";
import { AdminDebugRouteContent } from "@/tanstack/admin/debug/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminDebugPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<AdminDebugRouteData, DebugRouteSearch>) => (
  <AdminDebugRouteContent {...loaderData} navigate={navigate} search={search} />
);

export const route = defineAdminRoute<AdminDebugRouteData, DebugRouteSearch>({
  // `head` after `load`, always.
  load: async ({ context, search, t }) =>
    await loadAdminDebugRoute({
      ...context,
      params: debugLogsRouteParams(search),
      t,
    }),
  head: ({ loaderData }) => ({ ...loaderData }),

  /** A developer screen, deliberately absent from the trail. */
  breadcrumb: null,
});

export default AdminDebugPage;
