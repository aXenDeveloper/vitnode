import { notFound } from "@tanstack/react-router";

import type { PluginRoutePageProps } from "@/routing";

import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { AiUsagePanelContent } from "@/tanstack/settings-ai/panel";
import { settingsBreadcrumb } from "@/tanstack/settings/breadcrumb";
import {
  aiUsageQueryOptions,
  hasAiFeatures,
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

    const usage = await context.queryClient.query({
      ...aiUsageQueryOptions({ userId }),
      staleTime: "static",
    });
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    if (!hasAiFeatures(usage)) throw notFound();

    return { userId };
  },
  head: ({ t }) => ({
    title: `${t("core.auth.settings.nav.ai")} - ${t("core.auth.settings.title")}`,
  }),

  breadcrumb: settingsBreadcrumb("ai"),
});

export default AiUsagePage;
