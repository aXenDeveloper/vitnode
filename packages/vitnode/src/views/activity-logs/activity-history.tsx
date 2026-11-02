import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronRightIcon, HistoryIcon, RotateCwIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import {
  activityChangedFields,
  activityChangeRows,
  ActivityChanges,
} from "./activity-changes";
import { ActivityHistoryPending } from "./activity-history-pending";
import {
  ActivityActor,
  ActivityAreaBadge,
  useActivityLabels,
} from "./activity-labels";
import { activityEntityQueryOptions } from "./activity-query";

export interface ActivityHistoryProps {
  /** The plugin the resource belongs to - for a content record, its content type's plugin. */
  pluginId: string;
  /** The resource's id, as recorded (`String(id)`). */
  targetId: number | string;
  /** The recorded target type - a content type id such as `blog.category` for content. */
  targetType: string;
}

/**
 * The activity history of one resource, newest first - who created, changed,
 * published or moderated it, and what moved. Reads the central Activity Logs
 * through `GET /admin/activity-logs/entity`, which an admin may call with the
 * Activity Logs permission or with `can_view` on the content type itself.
 * AdminCP only.
 *
 * @example
 * ```tsx
 * import { ActivityHistory } from "@vitnode/core/views/activity-logs/activity-history";
 *
 * <ActivityHistory pluginId="@vitnode/blog" targetId={category.id} targetType="blog.category" />;
 * ```
 */
export const ActivityHistory = ({
  pluginId,
  targetId,
  targetType,
}: ActivityHistoryProps) => {
  const t = useTranslations("core.activity_logs");
  const tError = useTranslations("core.global.errors");
  const labels = useActivityLabels();
  const query = useInfiniteQuery(
    activityEntityQueryOptions({
      pluginId,
      targetId: String(targetId),
      targetType,
    }),
  );
  const entries = React.useMemo(
    () => query.data?.pages.flatMap(page => page.edges) ?? [],
    [query.data],
  );

  if (query.isPending) return <ActivityHistoryPending label={t("loading")} />;
  if (query.isError) {
    return (
      <Empty className="border" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HistoryIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("error_title")}</EmptyTitle>
          <EmptyDescription>{t("error_desc")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            isLoading={query.isFetching}
            onClick={() => {
              void query.refetch();
            }}
            size="sm"
            variant="outline"
          >
            <RotateCwIcon aria-hidden="true" />
            {tError("try_again")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
          <HistoryIcon aria-hidden className="size-5" />
        </span>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("history.empty")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-5">
        {entries.map(entry => {
          const rows = activityChangeRows(entry.changes, name =>
            labels.field(entry, name),
          );
          const changedFields = activityChangedFields(entry.metadata);
          const locale =
            typeof entry.metadata.locale === "string"
              ? entry.metadata.locale
              : null;

          return (
            <li className="flex gap-3" key={entry.id}>
              <span
                aria-hidden
                className="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full"
              >
                <HistoryIcon className="size-4" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-pretty">
                    {labels.action(entry)}
                  </span>
                  {locale ? <Badge variant="outline">{locale}</Badge> : null}
                  <ActivityAreaBadge area={entry.area} />
                </div>
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                  <ActivityActor entry={entry} linkToAdmin />
                  <span aria-hidden>·</span>
                  <DateFormat date={entry.createdAt} />
                </div>
                {rows.length > 0 ? (
                  <Collapsible>
                    <CollapsibleTrigger className="group/changes text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-xs transition-colors duration-150 outline-none focus-visible:ring-3">
                      <ChevronRightIcon
                        aria-hidden="true"
                        className="ease-fluid size-3.5 transition-transform duration-200 group-data-panel-open/changes:rotate-90 motion-reduce:transition-none"
                      />
                      {t("detail.changes")}
                    </CollapsibleTrigger>
                    <CollapsibleContent
                      className="group/changes-panel ease-fluid h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-200 data-ending-style:h-0 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none"
                      keepMounted
                    >
                      <div className="ease-fluid pt-2 transition-transform duration-200 group-data-ending-style/changes-panel:-translate-y-1 group-data-ending-style/changes-panel:duration-150 group-data-starting-style/changes-panel:-translate-y-1 motion-reduce:transition-none">
                        <ActivityChanges rows={rows} />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}
                {rows.length === 0 && changedFields.length > 0 ? (
                  <ul className="flex flex-wrap gap-1">
                    {changedFields.map(name => (
                      <li key={name}>
                        <Badge variant="secondary">
                          {labels.field(entry, name)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {query.hasNextPage ? (
        <Button
          className="self-center"
          isLoading={query.isFetchingNextPage}
          onClick={() => {
            void query.fetchNextPage();
          }}
          variant="outline"
        >
          {t("history.load_more")}
        </Button>
      ) : null}
    </div>
  );
};
