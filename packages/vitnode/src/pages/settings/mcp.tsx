import type { PluginRoutePageProps } from "@/routing";

import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { settingsBreadcrumb } from "@/tanstack/settings/breadcrumb";
import { McpPanelContent } from "@/views/auth/settings/mcp/mcp-panel";
import { mcpSettingsQueryOptions } from "@/views/auth/settings/mcp/mcp-query";

interface McpData {
  userId: number;
}

const McpPage = ({ loaderData }: PluginRoutePageProps<McpData>) => (
  <McpPanelContent userId={loaderData.userId} />
);

export const route = defineAuthenticatedRoute<McpData>({
  load: async ({ context }) => {
    const userId = context.auth.user.id;

    // Warmed, not required: a failed load is shown on the page with a retry.
    await context.queryClient
      .query({ ...mcpSettingsQueryOptions({ userId }), staleTime: "static" })
      .catch(() => undefined);

    return { userId };
  },
  head: ({ t }) => ({
    title: `${t("core.auth.settings.nav.mcp")} - ${t("core.auth.settings.title")}`,
  }),

  breadcrumb: settingsBreadcrumb("mcp"),
});

export default McpPage;
