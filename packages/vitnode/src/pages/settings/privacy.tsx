import type { PluginRoutePageProps } from "@/routing";

import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { settingsBreadcrumb } from "@/tanstack/settings/breadcrumb";
import { PrivacyPanelContent } from "@/tanstack/settings/privacy-panel";
import { accountDeletionQueryOptions } from "@/views/auth/settings/privacy/privacy-query";

interface PrivacyData {
  userId: number;
}

const PrivacyPage = ({ loaderData }: PluginRoutePageProps<PrivacyData>) => (
  <PrivacyPanelContent userId={loaderData.userId} />
);

export const route = defineAuthenticatedRoute<PrivacyData>({
  load: async ({ context }) => {
    const userId = context.auth.user.id;

    await context.queryClient.query({
      ...accountDeletionQueryOptions({ userId }),
      staleTime: "static",
    });

    return { userId };
  },
  head: ({ t }) => ({
    title: `${t("core.auth.settings.nav.privacy")} - ${t("core.auth.settings.title")}`,
  }),

  breadcrumb: settingsBreadcrumb("privacy"),
});

export default PrivacyPage;
