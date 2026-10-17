import { debugOverviewRoute } from "@/tanstack/admin/debug/route";
import { DebugOverviewTab } from "@/tanstack/admin/debug/sections";

const AdminDebugOverviewPage = () => <DebugOverviewTab />;

export const route = debugOverviewRoute;

export default AdminDebugOverviewPage;
