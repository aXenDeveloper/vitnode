import type { PluginRoutePageProps } from "@/routing";
import type { AdminAiRouteData } from "@/tanstack/admin/ai/route";

import { AdminAiActionsRouteContent } from "@/tanstack/admin/ai/actions-screen";
import { loadAdminAiActionsRoute } from "@/tanstack/admin/ai/route";
import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminAiActionsPage = ({
  loaderData,
}: PluginRoutePageProps<AdminAiRouteData>) => (
  <AdminAiActionsRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminAiRouteData>({
  load: async ({ context, t }) =>
    await loadAdminAiActionsRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "ai", "actions"] }),
});

export default AdminAiActionsPage;
