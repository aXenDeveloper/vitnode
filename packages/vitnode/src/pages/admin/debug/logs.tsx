import type { PluginRoutePageProps } from "@/routing";
import type { DebugLogsRouteSearch } from "@/tanstack/admin/debug/route-search";

import { debugLogsRoute } from "@/tanstack/admin/debug/route";
import { DebugLogsTab } from "@/tanstack/admin/debug/tables";

const AdminDebugLogsPage = ({
  navigate,
  search,
}: PluginRoutePageProps<undefined, DebugLogsRouteSearch>) => (
  <DebugLogsTab navigate={navigate} search={search} />
);

export const route = debugLogsRoute;

export default AdminDebugLogsPage;
