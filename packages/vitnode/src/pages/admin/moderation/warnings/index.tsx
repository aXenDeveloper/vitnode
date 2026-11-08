import { loadAdminWarningReasonsTab } from "@/tanstack/admin/warnings/route";
import { AdminWarningReasonsRouteContent } from "@/tanstack/admin/warnings/screen";
import { defineAdminRoute } from "@/tanstack/plugin-routes";

const AdminWarningReasonsPage = () => <AdminWarningReasonsRouteContent />;

export const route = defineAdminRoute({
  load: async ({ context }) => await loadAdminWarningReasonsTab(context),
});

export default AdminWarningReasonsPage;
