import { loadAdminWarningThresholdsTab } from "@/tanstack/admin/warnings/route";
import {
  AdminWarningThresholdsCrumb,
  AdminWarningThresholdsRouteContent,
} from "@/tanstack/admin/warnings/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminWarningThresholdsPage = () => <AdminWarningThresholdsRouteContent />;

export const route = defineAdminRoute({
  load: async ({ context }) => await loadAdminWarningThresholdsTab(context),

  breadcrumb: AdminWarningThresholdsCrumb,
});

export default AdminWarningThresholdsPage;
