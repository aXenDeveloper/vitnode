import type { PluginRoutePageProps } from "@/routing";

import type { ModcpReportRouteData } from "../../tanstack/moderation/route";

import { ModcpReportBreadcrumb } from "../../tanstack/moderation/breadcrumb";
import { ModcpReportRouteContent } from "../../tanstack/moderation/report-screen";
import { loadModcpReportRoute } from "../../tanstack/moderation/route";
import { defineAuthenticatedRoute } from "../../tanstack/plugin-routes";

const ModcpReportPage = ({
  loaderData,
}: PluginRoutePageProps<ModcpReportRouteData>) => (
  <ModcpReportRouteContent id={loaderData.id} userId={loaderData.userId} />
);

export const route = defineAuthenticatedRoute<ModcpReportRouteData>({
  load: async ({ context, params, t }) =>
    await loadModcpReportRoute({ ...context, id: params.id ?? "", t }),
  head: ({ loaderData }) => ({ robots: "noindex, nofollow", ...loaderData }),

  breadcrumb: ModcpReportBreadcrumb,
});

export default ModcpReportPage;
