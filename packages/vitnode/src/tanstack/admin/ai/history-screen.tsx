import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";
import type { AiHistoryFilters } from "@/views/admin/views/core/ai/ai-query";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { PageTitle } from "@/components/ui/page-title";
import { AiHistoryTableContent } from "@/views/admin/views/core/ai/history/history-table-content";

import type { AdminTableNavigate } from "../table-search";
import type { AdminAiHistoryRouteData } from "./route";
import type {
  AiHistoryRouteSearch,
  UncheckedAiHistorySearch,
} from "./route-search";

import { RouteMessages } from "../../i18n/route-messages";
import {
  adminAiActionsQuery,
  adminAiHistoryQuery,
  adminAiModelsQuery,
  adminAiRunQuery,
} from "./query";
import { ADMIN_AI_NAMESPACES } from "./route";
import {
  aiHistorySearchFrom,
  aiHistorySearchParams,
  normalizeAiHistoryRouteSearch,
} from "./route-search";

export interface AdminAiHistoryRouteProps extends AdminAiHistoryRouteData {
  navigate: AdminTableNavigate<AiHistoryRouteSearch>;
  search: UncheckedAiHistorySearch;
}

export const AdminAiHistoryRouteContent = ({
  adminUserId,
  description,
  navigate,
  params,
  search,
  title,
}: AdminAiHistoryRouteProps) => {
  const { data } = useSuspenseQuery(
    adminAiHistoryQuery({ adminUserId, params }),
  );
  const { data: actionsData } = useSuspenseQuery(
    adminAiActionsQuery({ adminUserId }),
  );
  const { data: modelsData } = useSuspenseQuery(
    adminAiModelsQuery({ adminUserId }),
  );

  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: aiHistorySearchFrom(nextSearch),
        });
      },
      searchParams: aiHistorySearchParams(search),
    }),
    [navigate, search],
  );

  const { action, actorType, first, modelId, order, status } =
    normalizeAiHistoryRouteSearch(search);
  const filters: AiHistoryFilters = { action, actorType, modelId, status };

  return (
    <RouteMessages namespaces={ADMIN_AI_NAMESPACES}>
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <PageTitle className="mb-0" desc={description} h1={title} />

        <DataTableNavigationProvider value={navigation}>
          <AiHistoryTableContent
            actions={actionsData.actions}
            data={data}
            filters={filters}
            models={modelsData.models}
            onFilterChange={next => {
              // A new filter starts from the first page.
              void navigate({
                resetScroll: false,
                search: normalizeAiHistoryRouteSearch({
                  ...next,
                  first,
                  order,
                }),
              });
            }}
            runQuery={id => adminAiRunQuery({ adminUserId, id })}
          />
        </DataTableNavigationProvider>
      </div>
    </RouteMessages>
  );
};
