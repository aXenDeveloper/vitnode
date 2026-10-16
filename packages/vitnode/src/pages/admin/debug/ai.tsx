import type { PluginRoutePageProps } from "@/routing";
import type { AiHistoryRouteSearch } from "@/tanstack/admin/ai/route-search";

import { debugAiRoute } from "@/tanstack/admin/debug/route";
import { DebugAiTab } from "@/tanstack/admin/debug/tables";
import { useAdminIdentity } from "@/tanstack/admin/identity";

const AdminDebugAiPage = ({
  navigate,
  search,
}: PluginRoutePageProps<undefined, AiHistoryRouteSearch>) => (
  <DebugAiTab
    adminUserId={useAdminIdentity()}
    navigate={navigate}
    search={search}
  />
);

export const route = debugAiRoute;

export default AdminDebugAiPage;
