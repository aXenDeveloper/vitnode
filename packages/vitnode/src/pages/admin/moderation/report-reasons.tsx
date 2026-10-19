import type { PluginRoutePageProps } from "@/routing";
import type { AdminReportReasonsRouteData } from "@/tanstack/admin/report-reasons/route";

import { adminBreadcrumb } from "@/tanstack/admin/breadcrumb";
import { loadAdminReportReasonsRoute } from "@/tanstack/admin/report-reasons/route";
import { AdminReportReasonsRouteContent } from "@/tanstack/admin/report-reasons/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminReportReasonsPage = ({
  loaderData,
}: PluginRoutePageProps<AdminReportReasonsRouteData>) => (
  <AdminReportReasonsRouteContent {...loaderData} />
);

export const route = defineAdminRoute<AdminReportReasonsRouteData>({
  load: async ({ context, t }) =>
    await loadAdminReportReasonsRoute({ ...context, t }),
  head: ({ loaderData }) => ({ ...loaderData }),

  breadcrumb: adminBreadcrumb({
    segments: ["core", "moderation", "report-reasons"],
  }),
});

export default AdminReportReasonsPage;
