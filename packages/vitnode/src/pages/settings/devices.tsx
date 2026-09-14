import type { PluginRoutePageProps } from "@/routing";

import { DevicesPanelContent } from "@/tanstack/devices/panel";
import { devicesQuery } from "@/tanstack/devices/query";
import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { settingsBreadcrumb } from "@/tanstack/settings/breadcrumb";

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
      ...devicesQuery(userId),
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
