import type { PluginRoutePageProps } from "@/routing";

import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { userProfileQuery } from "@/tanstack/profile/query";
import { OverviewSettings } from "@/tanstack/settings/overview";
import { personalInfoPolicyQuery } from "@/tanstack/settings/personal-policy";

interface OverviewData {
  nameCode: string;
}

const OverviewPage = ({ loaderData }: PluginRoutePageProps<OverviewData>) => (
  <OverviewSettings nameCode={loaderData.nameCode} />
);

export const route = defineAuthenticatedRoute<OverviewData>({
  load: async ({ context }) => {
    const { nameCode } = context.auth.user;

    await Promise.all([
      context.queryClient.query({
        ...userProfileQuery(nameCode),
        staleTime: "static",
      }),
      context.queryClient.query(personalInfoPolicyQuery()),
    ]);

    return { nameCode };
  },
  head: ({ t }) => ({
    title: `${t("core.auth.settings.nav.overview")} - ${t("core.auth.settings.title")}`,
  }),
});

export default OverviewPage;
