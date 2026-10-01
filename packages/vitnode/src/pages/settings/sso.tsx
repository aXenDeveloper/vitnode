import { notFound } from "@tanstack/react-router";

import type { PluginRoutePageProps } from "@/routing";
import type { SsoSettingsSearch } from "@/tanstack/sso-connections/route-search";

import {
  loadMiddlewareConfig,
  MiddlewareConfigUnknownError,
} from "@/tanstack/auth/middleware-config";
import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { settingsBreadcrumb } from "@/tanstack/settings/breadcrumb";
import { SsoConnectionsPanelContent } from "@/tanstack/sso-connections/panel";
import { ssoConnectionsQueryOptions } from "@/views/auth/settings/sso/sso-connections-query";

interface SsoData {
  nameCode: string;
  userId: number;
}

const SsoPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<SsoData, SsoSettingsSearch>) => (
  <SsoConnectionsPanelContent
    nameCode={loaderData.nameCode}
    navigate={navigate}
    search={search}
    userId={loaderData.userId}
  />
);

export const route = defineAuthenticatedRoute<SsoData, SsoSettingsSearch>({
  load: async ({ context }) => {
    const config = await loadMiddlewareConfig(context.queryClient);

    if (!config.isKnown) throw new MiddlewareConfigUnknownError();

    // eslint-disable-next-line @typescript-eslint/only-throw-error
    if (config.sso.length === 0) throw notFound();

    const { id: userId, nameCode } = context.auth.user;

    await context.queryClient.query({
      ...ssoConnectionsQueryOptions({ userId }),
      staleTime: "static",
    });

    return { nameCode, userId };
  },
  head: ({ t }) => ({
    title: `${t("core.auth.settings.nav.sso")} - ${t("core.auth.settings.title")}`,
  }),

  breadcrumb: settingsBreadcrumb("sso"),
});

export default SsoPage;
