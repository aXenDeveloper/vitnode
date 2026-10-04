import type { PluginRoutePageProps } from "@/routing";
import type { AdminAiRouteData } from "@/tanstack/admin/ai/route";

import { loadAdminAiSettingsRoute } from "@/tanstack/admin/ai/route";
import { AdminAiSettingsRouteContent } from "@/tanstack/admin/ai/settings-screen";
import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminAiSettingsPage = ({
  loaderData,
}: PluginRoutePageProps<AdminAiRouteData>) => (
  <AdminAiSettingsRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminAiRouteData>({
  // `head` after `load`, always.
  load: async ({ context, t }) =>
    await loadAdminAiSettingsRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "ai", "settings"] }),
});

export default AdminAiSettingsPage;
