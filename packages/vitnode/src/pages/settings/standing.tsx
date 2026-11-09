import type { PluginRoutePageProps } from "@/routing";

import type { StandingRouteSearch } from "../../tanstack/settings-standing/route";

import { defineAuthenticatedRoute } from "../../tanstack/plugin-routes";
import { StandingPanelContent } from "../../tanstack/settings-standing/panel";
import { loadStandingRoute } from "../../tanstack/settings-standing/route";
import { settingsBreadcrumb } from "../../tanstack/settings/breadcrumb";

type StandingData = Record<string, never>;

const StandingPage = ({
  navigate,
  search,
}: PluginRoutePageProps<StandingData, StandingRouteSearch>) => (
  <StandingPanelContent navigate={navigate} search={search} />
);

export const route = defineAuthenticatedRoute<
  StandingData,
  StandingRouteSearch
>({
  load: async ({ context, search }) => {
    await loadStandingRoute({ queryClient: context.queryClient, search });

    return {};
  },
  head: ({ t }) => ({
    robots: "noindex, nofollow",
    title: `${t("core.auth.settings.nav.standing")} - ${t("core.auth.settings.title")}`,
  }),

  breadcrumb: settingsBreadcrumb("standing"),
});

export default StandingPage;
