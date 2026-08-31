"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { HeaderContent } from "@/components/ui/header-content";
import { SearchHeaderActions } from "@/views/admin/views/core/advanced/search/search-header-actions";
import { SearchIndexContent } from "@/views/admin/views/core/advanced/search/search-index-content";

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
  /**
   * Names for the collections a Content Engine content type contributes.
   *
   * Optional, and absent in Stage 12. They come from the *frontend* content-type
   * registry, which is server-side config: the Next.js page reads it directly,
   * and a TanStack Start host can only pass them once it has a browser-side
   * registry - the same seam `AdminShellContent`'s `declarations` prop is
   * waiting on. Without them a content collection falls back to the search
   * renderer's own label, and its `itemType` is still shown, so nothing is
   * hidden - it is named less well.
   */
  collectionLabels?: Map<string, string>;
  navigate: AdminTableNavigate<SearchIndexRouteSearch>;
  search: UncheckedSearchIndexSearch;
}

/**
 * `/admin/core/advanced/search`, as everything below a route file's `component`.
 *
 * The header's "rebuild everything" button and the two row actions share one
 * `actions` object, so all three refresh the same way: a query invalidation on
 * success. `useSearchIndexActions` is what supplies it, and `SearchIndexActions`
 * is the seam it satisfies.
 */
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
      <div className="p-4">
        <HeaderContent desc={description} h1={title}>
          <SearchHeaderActions onRebuild={actions.rebuild} />
        </HeaderContent>

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
