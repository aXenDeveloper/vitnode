import { debugPluginsRoute } from "@/tanstack/admin/debug/route";
import { DebugPluginsTab } from "@/tanstack/admin/debug/sections";

const AdminDebugPluginsPage = () => <DebugPluginsTab />;

export const route = debugPluginsRoute;

export default AdminDebugPluginsPage;
