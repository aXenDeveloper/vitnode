import type { PluginRoutePageProps } from "@/routing";
import type { AdminIntegrationsRouteData } from "@/tanstack/admin/integrations/route";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminIntegrationsRoute } from "@/tanstack/admin/integrations/route";
import { AdminIntegrationsRouteContent } from "@/tanstack/admin/integrations/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminIntegrationsPage = ({
  loaderData,
}: PluginRoutePageProps<AdminIntegrationsRouteData>) => (
  <AdminIntegrationsRouteContent {...loaderData} />
);

/**
 * The heading's strings come from the loader, so the `<h1>` and the `<title>`
 * are the same string by construction.
 */
export const route = defineAdminRoute<AdminIntegrationsRouteData>({
  // `head` after `load`, always.
  load: async ({ context, t }) =>
    await loadAdminIntegrationsRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({ segments: ["core", "system", "integrations"] }),
});

export default AdminIntegrationsPage;
