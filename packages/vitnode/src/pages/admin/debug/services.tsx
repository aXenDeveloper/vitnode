import { debugServicesRoute } from "@/tanstack/admin/debug/route";
import { DebugServicesTab } from "@/tanstack/admin/debug/sections";

const AdminDebugServicesPage = () => <DebugServicesTab />;

export const route = debugServicesRoute;

export default AdminDebugServicesPage;
