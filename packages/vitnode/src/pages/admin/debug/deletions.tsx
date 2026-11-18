import type { PluginRoutePageProps } from "@/routing";
import type { DebugDeletionsRouteSearch } from "@/tanstack/admin/debug/route-search";

import { debugDeletionsRoute } from "@/tanstack/admin/debug/route";
import { DebugDeletionsTab } from "@/tanstack/admin/debug/tables";

const AdminDebugDeletionsPage = ({
  navigate,
  search,
}: PluginRoutePageProps<undefined, DebugDeletionsRouteSearch>) => (
  <DebugDeletionsTab navigate={navigate} search={search} />
);

export const route = debugDeletionsRoute;

export default AdminDebugDeletionsPage;
