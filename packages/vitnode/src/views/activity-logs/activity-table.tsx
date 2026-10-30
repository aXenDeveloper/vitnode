import { ChevronRightIcon, HistoryIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { ActivityEntry, ActivityFilterOptions } from "./activity-query";

import {
  ActivityActor,
  ActivityAreaBadge,
  useActivityLabels,
} from "./activity-labels";

export interface ActivityTableProps {
  entries: ActivityEntry[];
  fetchNextPage: () => void;
  hasNextPage: boolean;
  /** A refetch for new filters is under way: the rows stay, dimmed. */
  isFetching: boolean;
  isFetchingNextPage: boolean;
  onOpen: (entry: ActivityEntry) => void;
  plugins: ActivityFilterOptions["plugins"];
}

export const ActivityEmpty = () => {
  const t = useTranslations("core.activity_logs");

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HistoryIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{t("empty_title")}</EmptyTitle>
        <EmptyDescription>{t("empty_desc")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

/**
 * The entries, newest first: cards on a phone, a table from `md` up. Every
 * entry opens its detail sheet from a real button, so it works from the
 * keyboard; "Load older activity" follows the keyset cursor.
 */
export const ActivityTable = ({
  entries,
  fetchNextPage,
  hasNextPage,
  isFetching,
  isFetchingNextPage,
  onOpen,
  plugins,
}: ActivityTableProps) => {
  const t = useTranslations("core.activity_logs");
  const labels = useActivityLabels(plugins);
  // One area for every entry - always so in the moderators' log - says nothing.
  const showArea = new Set(entries.map(entry => entry.area)).size > 1;

  if (entries.length === 0) return <ActivityEmpty />;

  return (
    <div
      aria-busy={isFetching}
      className={isFetching && !isFetchingNextPage ? "opacity-60" : undefined}
    >
      <ul className="flex flex-col gap-2 md:hidden">
        {entries.map(entry => (
          <li key={entry.id}>
            <button
              className="bg-card hover:bg-muted/50 focus-visible:ring-ring/50 flex w-full flex-col gap-2 rounded-lg border p-3 text-start outline-none focus-visible:ring-3"
              onClick={() => {
                onOpen(entry);
              }}
              type="button"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-pretty">
                  {labels.action(entry)}
                </span>
                {showArea ? <ActivityAreaBadge area={entry.area} /> : null}
              </span>
              <span className="text-muted-foreground truncate text-sm">
                {labels.target(entry)}
              </span>
              <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                <ActivityActor entry={entry} />
                <span aria-hidden>·</span>
                <DateFormat date={entry.createdAt} />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.date")}</TableHead>
              <TableHead>{t("columns.actor")}</TableHead>
              {showArea ? <TableHead>{t("columns.area")}</TableHead> : null}
              <TableHead>{t("columns.plugin")}</TableHead>
              <TableHead>{t("columns.action")}</TableHead>
              <TableHead>{t("columns.target")}</TableHead>
              <TableHead className="text-end">
                <span className="sr-only">{t("columns.details")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(entry => (
              <TableRow
                className="cursor-pointer"
                key={entry.id}
                onClick={() => {
                  onOpen(entry);
                }}
              >
                <TableCell className="whitespace-nowrap">
                  <DateFormat date={entry.createdAt} />
                </TableCell>
                <TableCell className="max-w-48">
                  <ActivityActor entry={entry} />
                </TableCell>
                {showArea ? (
                  <TableCell>
                    <ActivityAreaBadge area={entry.area} />
                  </TableCell>
                ) : null}
                <TableCell className="text-muted-foreground max-w-40 truncate">
                  {labels.plugin(entry.pluginId)}
                </TableCell>
                <TableCell className="font-medium">
                  {labels.action(entry)}
                </TableCell>
                <TableCell className="max-w-64 truncate">
                  {labels.target(entry)}
                </TableCell>
                <TableCell className="text-end">
                  <Button
                    aria-label={t("open_details", {
                      action: labels.action(entry),
                    })}
                    onClick={event => {
                      event.stopPropagation();
                      onOpen(entry);
                    }}
                    size="icon"
                    variant="ghost"
                  >
                    <ChevronRightIcon aria-hidden />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {hasNextPage ? (
        <div className="flex justify-center pt-4">
          <Button
            isLoading={isFetchingNextPage}
            onClick={fetchNextPage}
            variant="outline"
          >
            {t("load_more")}
          </Button>
        </div>
      ) : null}
      <span className="sr-only" role="status">
        {isFetching ? t("loading") : ""}
      </span>
    </div>
  );
};
