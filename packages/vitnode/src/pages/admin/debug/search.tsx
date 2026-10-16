import type { PluginRoutePageProps } from "@/routing";
import type { SearchIndexRouteSearch } from "@/tanstack/admin/search-index/route-search";

import { debugSearchRoute } from "@/tanstack/admin/debug/route";
import { DebugSearchTab } from "@/tanstack/admin/debug/tables";

const AdminDebugSearchPage = ({
  navigate,
  search,
}: PluginRoutePageProps<undefined, SearchIndexRouteSearch>) => (
  <DebugSearchTab navigate={navigate} search={search} />
);

export const route = debugSearchRoute;

export default AdminDebugSearchPage;
