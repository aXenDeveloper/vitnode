import type { PluginRoutePageProps } from "@/routing";
import type { QueueRouteSearch } from "@/tanstack/admin/queue/route-search";

import { debugQueueRoute } from "@/tanstack/admin/debug/route";
import { DebugQueueTab } from "@/tanstack/admin/debug/tables";

const AdminDebugQueuePage = ({
  navigate,
  search,
}: PluginRoutePageProps<undefined, QueueRouteSearch>) => (
  <DebugQueueTab navigate={navigate} search={search} />
);

export const route = debugQueueRoute;

export default AdminDebugQueuePage;
