import type { PluginRoutePageProps } from "@/routing";

import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { AiUsagePanelContent } from "@/tanstack/settings-ai/panel";
import { settingsBreadcrumb } from "@/tanstack/settings/breadcrumb";
import {
  aiHistoryQueryOptions,
  aiUsageQueryOptions,
} from "@/views/auth/settings/ai/ai-usage-query";

interface AiUsageData {
  userId: number;
}

const AiUsagePage = ({ loaderData }: PluginRoutePageProps<AiUsageData>) => (
  <AiUsagePanelContent userId={loaderData.userId} />
);

export const route = defineAuthenticatedRoute<AiUsageData>({
  load: async ({ context }) => {
    const userId = context.auth.user.id;

    await Promise.all([
      context.queryClient.query({
        ...aiUsageQueryOptions({ userId }),
        staleTime: "static",
      }),
      context.queryClient.infiniteQuery({
        ...aiHistoryQueryOptions({ userId }),
        staleTime: "static",
      }),
    ]);

    return { userId };
  },
  head: ({ t }) => ({
    title: `${t("core.auth.settings.nav.ai")} - ${t("core.auth.settings.title")}`,
  }),

  breadcrumb: settingsBreadcrumb("ai"),
});

export default AiUsagePage;
