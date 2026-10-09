import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";

import { AdminStaffPermissionGate } from "@/components/staff-permission/provider";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import { PageTitle } from "@/components/ui/page-title";
import { SearchHeaderActions } from "@/views/admin/views/core/advanced/search/search-header-actions";
import { SearchIndexContent } from "@/views/admin/views/core/advanced/search/search-index-content";
import { ADMIN_SEARCH_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminTableNavigate } from "../table-search";
import type { AdminSearchIndexRouteData } from "./route";
import type {
  SearchIndexRouteSearch,
  UncheckedSearchIndexSearch,
} from "./route-search";

import { RouteMessages } from "../../i18n/route-messages";
import { searchIndexQuery, useSearchIndexActions } from "./query";
import { ADMIN_SEARCH_INDEX_NAMESPACES } from "./route";
import { searchIndexSearchFrom, searchIndexSearchParams } from "./route-search";

export interface AdminSearchIndexRouteProps extends AdminSearchIndexRouteData {
  collectionLabels?: Map<string, string>;
  navigate: AdminTableNavigate<SearchIndexRouteSearch>;
  search: UncheckedSearchIndexSearch;
}

export const AdminSearchIndexRouteContent = ({
  collectionLabels,
  description,
  navigate,
  search,
  title,
}: AdminSearchIndexRouteProps) => {
  const { data } = useSuspenseQuery(searchIndexQuery());
  const actions = useSearchIndexActions();

  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: searchIndexSearchFrom(nextSearch),
        });
      },
      searchParams: searchIndexSearchParams(search),
    }),
    [navigate, search],
  );

  return (
    <RouteMessages namespaces={ADMIN_SEARCH_INDEX_NAMESPACES}>
      <div className="p-6">
        <PageTitle desc={description} h1={title}>
          <AdminStaffPermissionGate {...ADMIN_SEARCH_PERMISSIONS.manage}>
            <SearchHeaderActions onRebuild={actions.rebuild} />
          </AdminStaffPermissionGate>
        </PageTitle>

        <DataTableNavigationProvider value={navigation}>
          <SearchIndexContent
            actions={actions}
            data={data}
            labels={collectionLabels}
            search={
              typeof search.search === "string" ? search.search : undefined
            }
          />
        </DataTableNavigationProvider>
      </div>
    </RouteMessages>
  );
};
