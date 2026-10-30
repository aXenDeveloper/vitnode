import type { PluginRoutePageProps } from "@/routing";

import type { ModcpMemberRouteData } from "../../tanstack/moderation/warnings-route";

import { ModcpMemberBreadcrumb } from "../../tanstack/moderation/breadcrumb";
import { loadModcpMemberRoute } from "../../tanstack/moderation/warnings-route";
import { ModcpMemberRouteContent } from "../../tanstack/moderation/warnings-screen";
import { defineAuthenticatedRoute } from "../../tanstack/plugin-routes";

const ModcpMemberPage = ({
  loaderData,
}: PluginRoutePageProps<ModcpMemberRouteData>) => (
  <ModcpMemberRouteContent id={loaderData.id} />
);

export const route = defineAuthenticatedRoute<ModcpMemberRouteData>({
  load: async ({ context, params, t }) =>
    await loadModcpMemberRoute({ ...context, id: params.id ?? "", t }),
  head: ({ loaderData }) => ({ robots: "noindex, nofollow", ...loaderData }),

  breadcrumb: ModcpMemberBreadcrumb,
});

export default ModcpMemberPage;
