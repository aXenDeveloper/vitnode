import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { CircleAlertIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { AuditStaffLog } from "@/lib/audit/const";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

import type { ActivityEntry, ActivityFilters } from "./activity-query";

import { ActivityFiltersBar } from "./activity-filters";
import {
  activityFilterOptionsQueryOptions,
  activityListQueryOptions,
} from "./activity-query";
import { ActivitySheet } from "./activity-sheet";
import { ActivityTable } from "./activity-table";

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
  /** Toolbar actions beside the filters - export and retention. */
  actions?: React.ReactNode;
  /** The entry whose sheet is open, from the URL. */
  entryId: null | number;
  filters: ActivityFilters;
  /** Writes filters and the open entry back into the URL. */
  onNavigate: (next: {
    entryId: null | number;
    filters: ActivityFilters;
  }) => void;
  /** Which staff log: admins' (with system and member activity) or moderators'. */
  staff: AuditStaffLog;
}

/**
 * Filters, the list and the detail sheet of one staff log - the admins' or the
 * moderators' Activity Logs in AdminCP -> Staff.
 */
export const ActivityScreen = ({
  actions,
  entryId,
  filters,
  onNavigate,
  staff,
}: ActivityScreenProps) => {
  const t = useTranslations("core.activity_logs");
  const { data: options } = useSuspenseQuery(
    activityFilterOptionsQueryOptions(),
  );
  const list = useInfiniteQuery(
    activityListQueryOptions({ ...filters, staff }),
  );
  const entries = React.useMemo(
    () => list.data?.pages.flatMap(page => page.edges) ?? [],
    [list.data],
  );
  const [openedFrom, setOpenedFrom] = React.useState<ActivityEntry>();
  const [actorName, setActorName] = React.useState<null | string>(null);

  const actorFromList = filters.actorId
    ? entries.find(entry => entry.actor?.id === filters.actorId)?.actor?.name
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <ActivityFiltersBar
            actorName={actorFromList ?? actorName}
            filters={filters}
            onChange={next => {
              onNavigate({ entryId: null, filters: next });
            }}
            options={options}
            staff={staff}
          />
        </div>
        {actions ? (
          <div className="flex flex-wrap gap-2 lg:flex-col">{actions}</div>
        ) : null}
      </div>

      {list.isPending ? <ActivityListPending /> : null}
      {list.isError && !list.data ? (
        <Empty className="border" role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleAlertIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{t("error_title")}</EmptyTitle>
            <EmptyDescription>{t("error_desc")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      {list.data ? (
        <ActivityTable
          entries={entries}
          fetchNextPage={() => {
            void list.fetchNextPage();
          }}
          hasNextPage={list.hasNextPage}
          isFetching={list.isFetching}
          isFetchingNextPage={list.isFetchingNextPage}
          onOpen={entry => {
            setOpenedFrom(entry);
            onNavigate({ entryId: entry.id, filters });
          }}
          plugins={options.plugins}
        />
      ) : null}

      <ActivitySheet
        entry={openedFrom?.id === entryId ? openedFrom : undefined}
        entryId={entryId}
        onFilterActor={actor => {
          setActorName(actor.name);
          onNavigate({
            entryId: null,
            filters: { ...filters, actorId: actor.id },
          });
        }}
        onOpenChange={open => {
          if (!open) onNavigate({ entryId: null, filters });
        }}
        plugins={options.plugins}
      />
    </div>
  );
};
