import { notFound } from "@tanstack/react-router";

import type { PluginRoutePageProps } from "@/routing";

import {
  loadMiddlewareConfig,
  MiddlewareConfigUnknownError,
} from "@/tanstack/auth/middleware-config";
import { PasskeysPanelContent } from "@/tanstack/passkeys/panel";
import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { settingsBreadcrumb } from "@/tanstack/settings/breadcrumb";
import { passkeysQueryOptions } from "@/views/auth/settings/passkeys/passkeys-query";
import { SecuritySettings } from "@/views/auth/settings/security/security";

interface SecurityData {
  userId: number;
}

const SecurityPage = ({ loaderData }: PluginRoutePageProps<SecurityData>) => (
  <SecuritySettings>
    <PasskeysPanelContent userId={loaderData.userId} />
  </SecuritySettings>
);

export const route = defineAuthenticatedRoute<SecurityData>({
  load: async ({ context }) => {
    const config = await loadMiddlewareConfig(context.queryClient);

    if (!config.isKnown) throw new MiddlewareConfigUnknownError();

    // oxlint-disable-next-line typescript/only-throw-error
    if (!config.passkeys) throw notFound();

    const userId = context.auth.user.id;

    await context.queryClient.query({
      ...passkeysQueryOptions({ userId }),
      staleTime: "static",
    });

    return { userId };
  },
  head: ({ t }) => ({
    title: `${t("core.auth.settings.nav.security")} - ${t("core.auth.settings.title")}`,
  }),

  breadcrumb: settingsBreadcrumb("security"),
});

export default SecurityPage;
