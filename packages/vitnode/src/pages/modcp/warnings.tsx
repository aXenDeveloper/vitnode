import type { PluginRoutePageProps } from "@/routing";

import type { ModcpRouteData } from "../../tanstack/moderation/route";
import type { ModcpWarningsRouteSearch } from "../../tanstack/moderation/warnings-route";

import { ModcpWarningsBreadcrumb } from "../../tanstack/moderation/breadcrumb";
import { loadModcpWarningsRoute } from "../../tanstack/moderation/warnings-route";
import { ModcpWarningsRouteContent } from "../../tanstack/moderation/warnings-screen";
import { defineAuthenticatedRoute } from "../../tanstack/plugin-routes";

const ModcpWarningsPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<ModcpRouteData, ModcpWarningsRouteSearch>) => (
  <ModcpWarningsRouteContent
    {...loaderData}
    navigate={navigate}
    search={search}
  />
);

export const route = defineAuthenticatedRoute<
  ModcpRouteData,
  ModcpWarningsRouteSearch
>({
  load: async ({ context, search, t }) =>
    await loadModcpWarningsRoute({ ...context, search, t }),
  head: ({ loaderData }) => ({ robots: "noindex, nofollow", ...loaderData }),

  breadcrumb: ModcpWarningsBreadcrumb,
});

export default ModcpWarningsPage;
