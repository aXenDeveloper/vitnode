import type { PluginRoutePageProps } from "@/routing";

import { middlewareConfigQueryOptions } from "@/tanstack/auth/middleware-config";
import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { settingsBreadcrumb } from "@/tanstack/settings/breadcrumb";
import { SettingsLayoutContent } from "@/tanstack/settings/layout";
import { loadPageWidgets } from "@/tanstack/widgets";
import { aiUsageQueryOptions } from "@/views/auth/settings/ai/ai-usage-query";
import { settingsPage } from "@/views/auth/settings/widgets/settings-page";

interface SettingsLayoutData {
  userId: number;
}

const SettingsLayout = ({
  children,
  loaderData,
}: PluginRoutePageProps<SettingsLayoutData> & {
  children: React.ReactNode;
}) => (
  <SettingsLayoutContent userId={loaderData.userId}>
    {children}
  </SettingsLayoutContent>
);

export const route = defineAuthenticatedRoute<SettingsLayoutData>({
  load: async ({ context }) => {
    const userId = context.auth.user.id;
    const [config] = await Promise.all([
      context.queryClient.query({
        ...middlewareConfigQueryOptions(),
        staleTime: "static",
      }),
      loadPageWidgets(context.queryClient, settingsPage),
    ]);
    if ((config.ai?.models.length ?? 0) > 0) {
      await context.queryClient
        .query({ ...aiUsageQueryOptions({ userId }), staleTime: "static" })
        .catch(() => undefined);
    }

    return { userId };
  },
  head: () => ({ robots: "noindex, nofollow" }),

  /** The first crumb of the trail; each panel adds its own after it. */
  breadcrumb: settingsBreadcrumb(),
});

export default SettingsLayout;
