import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { cn } from "cn";
import React from "react";

import { PageTitle } from "@/components/ui/page-title";
import { CardsPendingSkeleton } from "@/tanstack/pending";
import {
  AiOverviewContent,
  AiOverviewRangePicker,
} from "@/views/admin/views/core/ai/overview/overview-content";

import type { AdminAiOverviewRouteData } from "./route";
import type { AiOverviewRouteSearch } from "./route-search";

import { RouteMessages } from "../../i18n/route-messages";
import {
  adminAiActionsQuery,
  adminAiModelsQuery,
  adminAiOverviewQuery,
} from "./query";
import { ADMIN_AI_NAMESPACES } from "./route";

export interface AdminAiOverviewRouteProps extends AdminAiOverviewRouteData {
  navigate: (options: {
    resetScroll: boolean;
    search: AiOverviewRouteSearch;
  }) => Promise<void>;
}

export const AdminAiOverviewRouteContent = ({
  adminUserId,
  description,
  navigate,
  search,
  title,
}: AdminAiOverviewRouteProps) => {
  const overview = useQuery({
    ...adminAiOverviewQuery({ adminUserId, search }),
    placeholderData: keepPreviousData,
  });
  const { data: actionsData } = useSuspenseQuery(
    adminAiActionsQuery({ adminUserId }),
  );
  const { data: modelsData } = useSuspenseQuery(
    adminAiModelsQuery({ adminUserId }),
  );
  const modelNames = React.useMemo(
    () => new Map(modelsData.models.map(model => [model.id, model.name])),
    [modelsData.models],
  );
  const titles = React.useMemo(
    () =>
      new Map(actionsData.actions.map(action => [action.key, action.title])),
    [actionsData.actions],
  );

  const { data } = overview;

  if (!data) return <CardsPendingSkeleton />;

  return (
    <RouteMessages namespaces={ADMIN_AI_NAMESPACES}>
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <PageTitle className="mb-0" desc={description} h1={title}>
          <AiOverviewRangePicker
            data={data}
            onChange={next => {
              void navigate({ resetScroll: false, search: next });
            }}
          />
        </PageTitle>

        <div
          aria-busy={overview.isPlaceholderData}
          className={cn(
            "transition-opacity duration-150 ease-out motion-reduce:transition-none",
            overview.isPlaceholderData && "opacity-60",
          )}
        >
          <AiOverviewContent
            data={data}
            describeAction={key => titles.get(key) ?? null}
            describeModel={id => modelNames.get(id) ?? null}
            onMonthChange={month => {
              void navigate({
                resetScroll: false,
                search: { ...search, month },
              });
            }}
          />
        </div>
      </div>
    </RouteMessages>
  );
};
