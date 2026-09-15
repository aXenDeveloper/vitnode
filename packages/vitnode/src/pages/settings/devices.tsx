import type { PluginRoutePageProps } from "@/routing";

import { DevicesPanelContent } from "@/tanstack/devices/panel";
import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { settingsBreadcrumb } from "@/tanstack/settings/breadcrumb";
import { devicesQueryOptions } from "@/views/auth/settings/devices/devices-query";

interface DevicesData {
  userId: number;
}

const DevicesPage = ({ loaderData }: PluginRoutePageProps<DevicesData>) => (
  <DevicesPanelContent userId={loaderData.userId} />
);

export const route = defineAuthenticatedRoute<DevicesData>({
  load: async ({ context }) => {
    const userId = context.auth.user.id;

    await context.queryClient.query({
      ...devicesQueryOptions({ userId }),
      staleTime: "static",
    });

    return { userId };
  },
  head: ({ t }) => ({
    title: `${t("core.auth.settings.nav.devices")} - ${t("core.auth.settings.title")}`,
  }),

  breadcrumb: settingsBreadcrumb("devices"),
});

export default DevicesPage;
