import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { HistoryIcon, RotateCwIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { DataTableNavigation } from "@/components/table/navigation";
import type { AuditStaffLog } from "@/lib/audit/const";

import {
  FiltersPanelDataTable,
  FiltersPanelToggle,
} from "@/components/table/filters-panel";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import { PaginationDataTable } from "@/components/table/pagination";
import { SearchDataTable } from "@/components/table/search";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

import type { ActivityRouteSearch } from "./activity-search";

import {
  ActivityDateDrawerSection,
  ActivityDateRangeFilter,
} from "./activity-date-filter";
import { ActivityFiltersDrawer } from "./activity-filters-drawer";
import { useActivityStaffFilters } from "./activity-labels";
import {
  activityFilterOptionsQueryOptions,
  activityListQueryOptions,
} from "./activity-query";
import {
  activityPaginationOf,
  normalizeActivitySearch,
} from "./activity-search";
import { ActivitySheet } from "./activity-sheet";
import { ActivityEmpty, ActivityTable } from "./activity-table";
import { useActivityTableFilters } from "./activity-table-filters";

const toSearchParams = (search: ActivityRouteSearch) =>
  new URLSearchParams(
    Object.entries(search).map(([key, value]) => [key, String(value)]),
  );

const filterIdentity = ({
  first: _first,
  log: _log,
  page: _page,
  ...filters
}: ActivityRouteSearch) =>
  JSON.stringify(
    Object.entries(filters).sort(([a], [b]) => a.localeCompare(b)),
  );

/** Rows shaped like the table's, for the first load only - a refetch keeps the data. */
export const ActivityListPending = () => {
  const t = useTranslations("core.activity_logs");

  return (
    <div aria-busy className="flex flex-col gap-2">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton className="h-12 w-full rounded-lg" key={index} />
      ))}
    </div>
  );
};

export interface ActivityScreenProps {
  /** Writes the next filters, page and open entry back into the URL. */
  onSearchChange: (search: ActivityRouteSearch) => void;
  /** The route search: filters, page, page size and the open entry. */
  search: ActivityRouteSearch;
  /** Which staff log: admins' (with system and member activity) or moderators'. */
  staff: AuditStaffLog;
}

/**
 * The paginated list of one staff log, with its search and filters above it
 * and each entry's details opening in place - the admins' or the moderators'
 * Activity Logs in AdminCP -> Staff. Everything it shows lives in the URL, so
 * a filtered page with an open entry can be shared.
 */
export const ActivityScreen = ({
  onSearchChange,
  search,
  staff,
}: ActivityScreenProps) => {
  const t = useTranslations("core.activity_logs");
  const tError = useTranslations("core.global.errors");
  const { data: options } = useSuspenseQuery(
    activityFilterOptionsQueryOptions(),
  );
  const filters = useActivityStaffFilters({ options, search, staff });
  const tableFilters = useActivityTableFilters({
    options,
    pluginId: search.pluginId,
    staff,
  });
  const list = useQuery(
    activityListQueryOptions(filters, activityPaginationOf(search)),
  );
  const entries = list.data?.edges ?? [];
  const entryId = search.log ?? null;
  const [isPanelOpen, setIsPanelOpen] = React.useState(false);
  const panelId = React.useId();
  const isEntryOnPage = entries.some(entry => entry.id === entryId);

  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: nextSearch => {
        const next = normalizeActivitySearch(
          Object.fromEntries(new URLSearchParams(nextSearch)),
        );
        if (filterIdentity(next) !== filterIdentity(search)) {
          delete next.page;
          delete next.log;
        }
        onSearchChange(next);
      },
      searchParams: toSearchParams(search),
    }),
    [onSearchChange, search],
  );

  const setEntry = (next: null | number) => {
    const { log: _log, ...rest } = search;
    onSearchChange(
      normalizeActivitySearch(next === null ? rest : { ...rest, log: next }),
    );
  };

  const filterActor = (actor: { id: number; name: string }) => {
    const { log: _log, page: _page, ...rest } = search;
    onSearchChange(normalizeActivitySearch({ ...rest, actorId: actor.id }));
  };

  const renderBody = () => {
    if (list.isPending) {
      return (
        <div className="p-4">
          <ActivityListPending />
        </div>
      );
    }
    if (list.isError && !list.data) {
      return (
        <Empty role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HistoryIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("error_title")}</EmptyTitle>
            <EmptyDescription>{t("error_desc")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              isLoading={list.isFetching}
              onClick={() => {
                void list.refetch();
              }}
              variant="outline"
            >
              <RotateCwIcon aria-hidden="true" />
              {tError("try_again")}
            </Button>
          </EmptyContent>
        </Empty>
      );
    }
    if (!list.data || list.data.pageInfo.totalCount === 0) {
      return <ActivityEmpty />;
    }

    return (
      <>
        <ActivityTable
          entries={entries}
          isFetching={list.isFetching}
          onFilterActor={filterActor}
          onOpenChange={setEntry}
          openId={isEntryOnPage ? entryId : null}
          plugins={options.plugins}
        />
        <PaginationDataTable pageInfo={list.data.pageInfo} />
      </>
    );
  };

  return (
    <DataTableNavigationProvider value={navigation}>
      <div className="bg-card text-card-foreground ring-foreground/10 overflow-hidden rounded-xl shadow-xs ring-1">
        <div
          aria-label={t("filters.label")}
          className="border-foreground/10 border-b px-4 py-3"
          role="search"
        >
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <SearchDataTable
                searchPlaceholder={t("filters.search_placeholder")}
              />
            </div>
            <div className="md:hidden">
              <ActivityFiltersDrawer
                extra={{
                  keys: ["range", "from", "to"],
                  section: <ActivityDateDrawerSection />,
                }}
                filters={tableFilters}
                resultCount={list.data?.pageInfo.totalCount}
              />
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <FiltersPanelToggle
                controls={panelId}
                filters={tableFilters}
                isOpen={isPanelOpen}
                onOpenChange={setIsPanelOpen}
              />
              <ActivityDateRangeFilter />
            </div>
          </div>
          <div className="hidden md:block">
            <FiltersPanelDataTable
              filters={tableFilters}
              id={panelId}
              isOpen={isPanelOpen}
              onApplied={() => {
                setIsPanelOpen(false);
              }}
            />
          </div>
        </div>
        {renderBody()}
      </div>

      <ActivitySheet
        entryId={list.data && !isEntryOnPage ? entryId : null}
        onFilterActor={filterActor}
        onOpenChange={open => {
          if (!open) setEntry(null);
        }}
        plugins={options.plugins}
      />
    </DataTableNavigationProvider>
  );
};
