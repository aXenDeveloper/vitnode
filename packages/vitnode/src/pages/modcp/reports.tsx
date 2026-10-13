import type { PluginRoutePageProps } from "@/routing";

import type { ModcpReportsRouteData } from "../../tanstack/moderation/route";
import type { ModcpReportsRouteSearch } from "../../tanstack/moderation/route-search";

import { ModcpReportsBreadcrumb } from "../../tanstack/moderation/breadcrumb";
import { ModcpReportsRouteContent } from "../../tanstack/moderation/reports-screen";
import { loadModcpReportsRoute } from "../../tanstack/moderation/route";
import { defineAuthenticatedRoute } from "../../tanstack/plugin-routes";

const ModcpReportsPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<ModcpReportsRouteData, ModcpReportsRouteSearch>) => (
  <ModcpReportsRouteContent
    {...loaderData}
    navigate={navigate}
    search={search}
  />
);

export const route = defineAuthenticatedRoute<
  ModcpReportsRouteData,
  ModcpReportsRouteSearch
>({
  load: async ({ context, search, t }) =>
    await loadModcpReportsRoute({ ...context, search, t }),
  head: ({ loaderData }) => ({ robots: "noindex, nofollow", ...loaderData }),

  breadcrumb: ModcpReportsBreadcrumb,
});

export default ModcpReportsPage;
