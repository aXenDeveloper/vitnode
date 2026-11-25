import { notFound } from "@tanstack/react-router";

import type { PluginRoutePageProps } from "@/routing";

import {
  loadMiddlewareConfig,
  MiddlewareConfigUnknownError,
} from "@/tanstack/auth/middleware-config";
import { ConnectedAppsPanelContent } from "@/tanstack/connected-apps/panel";
import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { connectedAppsQueryOptions } from "@/views/auth/settings/connected-apps/connected-apps-query";

interface ConnectedAppsData {
  endpoint: string;
  userId: number;
}

const ConnectedAppsPage = ({
  loaderData,
}: PluginRoutePageProps<ConnectedAppsData>) => (
  <ConnectedAppsPanelContent
    endpoint={loaderData.endpoint}
    userId={loaderData.userId}
  />
);

export const route = defineAuthenticatedRoute<ConnectedAppsData>({
  load: async ({ context }) => {
    const config = await loadMiddlewareConfig(context.queryClient);

    if (!config.isKnown) throw new MiddlewareConfigUnknownError();

    // oxlint-disable-next-line typescript/only-throw-error
    if (!config.mcp?.enabled) throw notFound();

    const userId = context.auth.user.id;

    // Warmed, not awaited for its outcome: a failed read renders the page's
    // own retry state instead of the route's error screen.
    await context.queryClient
      .query({ ...connectedAppsQueryOptions({ userId }), staleTime: "static" })
      .catch(() => undefined);

    return { endpoint: config.mcp.endpoint ?? "/api/mcp", userId };
  },
  head: ({ t }) => ({
    title: `${t("core.auth.settings.nav.connected_apps")} - ${t("core.auth.settings.title")}`,
  }),
});

export default ConnectedAppsPage;
