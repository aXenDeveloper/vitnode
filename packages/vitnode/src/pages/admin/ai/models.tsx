import type { PluginRoutePageProps } from "@/routing";
import type { AdminAiRouteData } from "@/tanstack/admin/ai/route";

import { AdminAiModelsRouteContent } from "@/tanstack/admin/ai/models-screen";
import { loadAdminAiModelsRoute } from "@/tanstack/admin/ai/route";
import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminAiModelsPage = ({
  loaderData,
}: PluginRoutePageProps<AdminAiRouteData>) => (
  <AdminAiModelsRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminAiRouteData>({
  // `head` after `load`, always.
  load: async ({ context, t }) =>
    await loadAdminAiModelsRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "ai", "models"] }),
});

export default AdminAiModelsPage;
