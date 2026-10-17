import { debugVitnodeRoute } from "@/tanstack/admin/debug/route";
import { DebugVitnodeTab } from "@/tanstack/admin/debug/sections";

const AdminDebugVitnodePage = () => <DebugVitnodeTab />;

export const route = debugVitnodeRoute;

export default AdminDebugVitnodePage;
