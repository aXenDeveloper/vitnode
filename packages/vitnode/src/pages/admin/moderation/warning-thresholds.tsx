import type { PluginRoutePageProps } from "@/routing";
import type { AdminWarningsRouteData } from "@/tanstack/admin/warnings/route";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminWarningThresholdsRoute } from "@/tanstack/admin/warnings/route";
import { AdminWarningThresholdsRouteContent } from "@/tanstack/admin/warnings/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminWarningThresholdsPage = ({
  loaderData,
}: PluginRoutePageProps<AdminWarningsRouteData>) => (
  <AdminWarningThresholdsRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminWarningsRouteData>({
  load: async ({ context, t }) =>
    await loadAdminWarningThresholdsRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({
    segments: ["core", "moderation", "warning-thresholds"],
  }),
});

export default AdminWarningThresholdsPage;
