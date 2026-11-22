import type { PluginRoutePageProps } from "@/routing";

import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { personalInfoPolicyQuery } from "@/tanstack/settings/personal-policy";
import { PrivacyPanelContent } from "@/tanstack/settings/privacy-panel";
import { accountDeletionQueryOptions } from "@/views/auth/settings/privacy/privacy-query";

interface PrivacyData {
  userId: number;
  userName: string;
}

const PrivacyPage = ({ loaderData }: PluginRoutePageProps<PrivacyData>) => (
  <PrivacyPanelContent
    userId={loaderData.userId}
    userName={loaderData.userName}
  />
);

export const route = defineAuthenticatedRoute<PrivacyData>({
  load: async ({ context }) => {
    const { id: userId, name: userName } = context.auth.user;

    await Promise.all([
      context.queryClient.query({
        ...accountDeletionQueryOptions({ userId }),
        staleTime: "static",
      }),
      context.queryClient.query(personalInfoPolicyQuery()),
    ]);

    return { userId, userName };
  },
  head: ({ t }) => ({
    title: `${t("core.auth.settings.nav.privacy")} - ${t("core.auth.settings.title")}`,
  }),
});

export default PrivacyPage;
