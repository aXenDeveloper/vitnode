import { debugCacheRoute } from "@/tanstack/admin/debug/route";
import { DebugCacheTab } from "@/tanstack/admin/debug/sections";

const AdminDebugCachePage = () => <DebugCacheTab />;

export const route = debugCacheRoute;

export default AdminDebugCachePage;
