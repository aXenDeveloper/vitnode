import type { PluginRoutePageProps } from "@/routing";
import type { CronRouteSearch } from "@/tanstack/admin/cron/route-search";

import { debugCronRoute } from "@/tanstack/admin/debug/route";
import { DebugCronTab } from "@/tanstack/admin/debug/tables";

const AdminDebugCronPage = ({
  navigate,
  search,
}: PluginRoutePageProps<undefined, CronRouteSearch>) => (
  <DebugCronTab navigate={navigate} search={search} />
);

export const route = debugCronRoute;

export default AdminDebugCronPage;
