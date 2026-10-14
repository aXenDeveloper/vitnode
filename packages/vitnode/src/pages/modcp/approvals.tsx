import type { PluginRoutePageProps } from "@/routing";

import type { ModcpApprovalsRouteSearch } from "../../tanstack/moderation/approvals-route-search";
import type { ModcpRouteData } from "../../tanstack/moderation/route";

import { ModcpApprovalsRouteContent } from "../../tanstack/moderation/approvals-screen";
import { ModcpApprovalsBreadcrumb } from "../../tanstack/moderation/breadcrumb";
import { loadModcpApprovalsRoute } from "../../tanstack/moderation/route";
import { defineAuthenticatedRoute } from "../../tanstack/plugin-routes";

const ModcpApprovalsPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<ModcpRouteData, ModcpApprovalsRouteSearch>) => (
  <ModcpApprovalsRouteContent
    {...loaderData}
    navigate={navigate}
    search={search}
  />
);

export const route = defineAuthenticatedRoute<
  ModcpRouteData,
  ModcpApprovalsRouteSearch
>({
  load: async ({ context, search, t }) =>
    await loadModcpApprovalsRoute({ ...context, search, t }),
  head: ({ loaderData }) => ({ robots: "noindex, nofollow", ...loaderData }),

  breadcrumb: ModcpApprovalsBreadcrumb,
});

export default ModcpApprovalsPage;
