import type { PluginRoutePageProps } from "@/routing";

import { NotificationSettingsPanel } from "@/tanstack/notifications/settings-screen";
import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { settingsBreadcrumb } from "@/tanstack/settings/breadcrumb";
import { notificationPreferencesQueryOptions } from "@/views/notifications/notifications-query";

interface NotificationSettingsData {
  userId: number;
}

const NotificationSettingsPage = ({
  loaderData,
}: PluginRoutePageProps<NotificationSettingsData>) => (
  <NotificationSettingsPanel userId={loaderData.userId} />
);

export const route = defineAuthenticatedRoute<NotificationSettingsData>({
  load: async ({ context }) => {
    const userId = context.auth.user.id;

    await context.queryClient.query({
      ...notificationPreferencesQueryOptions({ userId }),
      staleTime: "static",
    });

    return { userId };
  },
  head: ({ t }) => ({
    title: `${t("core.auth.settings.nav.notifications")} - ${t("core.auth.settings.title")}`,
  }),

  breadcrumb: settingsBreadcrumb("notifications"),
});

export default NotificationSettingsPage;
