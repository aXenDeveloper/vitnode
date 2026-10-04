import type { PluginRoutePageProps } from "@/routing";
import type { AdminAiRouteData } from "@/tanstack/admin/ai/route";

import { AdminAiAccessRouteContent } from "@/tanstack/admin/ai/access-screen";
import { loadAdminAiAccessRoute } from "@/tanstack/admin/ai/route";
import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminAiAccessPage = ({
  loaderData,
}: PluginRoutePageProps<AdminAiRouteData>) => (
  <AdminAiAccessRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminAiRouteData>({
  // `head` after `load`, always.
  load: async ({ context, t }) =>
    await loadAdminAiAccessRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "ai", "access"] }),
});

export default AdminAiAccessPage;
