import type { PluginRoutePageProps } from "@/routing";
import type { AdminWarningsRouteData } from "@/tanstack/admin/warnings/route";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminWarningReasonsRoute } from "@/tanstack/admin/warnings/route";
import { AdminWarningReasonsRouteContent } from "@/tanstack/admin/warnings/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminWarningReasonsPage = ({
  loaderData,
}: PluginRoutePageProps<AdminWarningsRouteData>) => (
  <AdminWarningReasonsRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminWarningsRouteData>({
  load: async ({ context, t }) =>
    await loadAdminWarningReasonsRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({
    segments: ["core", "moderation", "warning-reasons"],
  }),
});

export default AdminWarningReasonsPage;
