import type { PluginRoutePageProps } from "@/routing";

import type { ModcpApprovalRouteData } from "../../tanstack/moderation/route";

import { ModcpApprovalRouteContent } from "../../tanstack/moderation/approval-screen";
import { ModcpApprovalBreadcrumb } from "../../tanstack/moderation/breadcrumb";
import { loadModcpApprovalRoute } from "../../tanstack/moderation/route";
import { defineAuthenticatedRoute } from "../../tanstack/plugin-routes";

const ModcpApprovalPage = ({
  loaderData,
}: PluginRoutePageProps<ModcpApprovalRouteData>) => (
  <ModcpApprovalRouteContent id={loaderData.id} />
);

export const route = defineAuthenticatedRoute<ModcpApprovalRouteData>({
  load: async ({ context, params, t }) =>
    await loadModcpApprovalRoute({ ...context, id: params.id ?? "", t }),
  head: ({ loaderData }) => ({ robots: "noindex, nofollow", ...loaderData }),

  breadcrumb: ModcpApprovalBreadcrumb,
});

export default ModcpApprovalPage;
