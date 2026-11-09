import { cn } from "cn";
import { ChevronRightIcon, HistoryIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import type { ActivityEntry, ActivityFilterOptions } from "./activity-query";

import { ActivityEntryPanel } from "./activity-entry-panel";
import {
  ActivityActor,
  ActivityAreaBadge,
  useActivityLabels,
} from "./activity-labels";

export interface ActivityTableProps {
  entries: ActivityEntry[];
  /** A new page or filter is loading: the rows stay, dimmed. */
  isFetching: boolean;
  /** Narrows the list to an entry's actor, from its open details. */
  onFilterActor: (actor: { id: number; name: string }) => void;
  /** Opens an entry's details in place, or closes them with `null`. */
  onOpenChange: (entryId: null | number) => void;
  openId: null | number;
  plugins: ActivityFilterOptions["plugins"];
}

export const ActivityEmpty = () => {
  const t = useTranslations("core.activity_logs");

  return (
    <Empty>
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

const CELL = "hidden min-w-0 items-center px-3 py-3 text-sm md:flex";

const isOwnControl = (target: EventTarget | null, row: HTMLElement) => {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node !== row) {
    if (node.matches("a, input, select, textarea")) return true;
    if (node.matches("button") && !node.dataset.activityToggle) return true;
    node = node.parentElement;
  }

  return false;
};

const ActivityRow = ({
  entry,
  isOpen,
  onToggle,
  panelId,
  plugins,
  showArea,
}: {
  entry: ActivityEntry;
  isOpen: boolean;
  onToggle: () => void;
  panelId: string;
  plugins: ActivityFilterOptions["plugins"];
  showArea: boolean;
}) => {
  const t = useTranslations("core.activity_logs");
  const labels = useActivityLabels(plugins);
  const action = labels.action(entry);
  const target = labels.target(entry);

  return (
    // react-doctor-disable-next-line react-doctor/interactive-supports-focus
    <div
      className="hover:bg-muted/50 col-span-full grid cursor-pointer grid-cols-subgrid"
      onClick={event => {
        if (isOwnControl(event.target, event.currentTarget)) return;
        onToggle();
      }}
      role="row"
    >
      <div
        className="flex items-start justify-center py-3 ps-3 sm:ps-4 md:items-center"
        role="cell"
      >
        <button
          aria-controls={panelId}
          aria-expanded={isOpen}
          aria-label={t(isOpen ? "hide_details" : "open_details", { action })}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-3"
          data-activity-toggle="true"
          onClick={event => {
            event.stopPropagation();
            onToggle();
          }}
          type="button"
        >
          <ChevronRightIcon
            aria-hidden
            className={cn(
              "size-4 transition-transform duration-200 ease-out motion-reduce:transition-none",
              isOpen && "rotate-90",
            )}
          />
        </button>
      </div>

      <div
        className="flex min-w-0 flex-col gap-1 py-3 ps-1 pe-4 md:hidden"
        role="cell"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-pretty">{action}</span>
          {showArea ? <ActivityAreaBadge area={entry.area} /> : null}
        </span>
        <span className="text-muted-foreground truncate text-sm">{target}</span>
        <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
          <ActivityActor entry={entry} linkToAdmin />
          <span aria-hidden>·</span>
          <DateFormat date={entry.createdAt} showFullDate />
        </span>
      </div>

      <div className={cn(CELL, "whitespace-nowrap tabular-nums")} role="cell">
        <DateFormat date={entry.createdAt} showFullDate />
      </div>
      <div className={CELL} role="cell">
        <ActivityActor className="block" entry={entry} linkToAdmin />
      </div>
      <div className={cn(CELL, "font-medium")} role="cell">
        <span className="text-pretty">{action}</span>
      </div>
      <div className={CELL} role="cell">
        <span className="truncate" title={target}>
          {target}
        </span>
      </div>
      <div className={cn(CELL, "pe-4 sm:pe-6")} role="cell">
        {showArea ? (
          <ActivityAreaBadge area={entry.area} />
        ) : (
          <span className="text-muted-foreground truncate">
            {labels.plugin(entry.pluginId)}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * The entries of one page, newest first. A row opens its details in place, in
 * a recessed well under it - one at a time, without moving the row - and
 * closes them again with the same toggle or Escape. Stacked on a phone, in
 * columns from `md` up.
 */
export const ActivityTable = ({
  entries,
  isFetching,
  onFilterActor,
  onOpenChange,
  openId,
  plugins,
}: ActivityTableProps) => {
  const t = useTranslations("core.activity_logs");
  const baseId = React.useId();
  const [closingId, setClosingId] = React.useState<null | number>(null);
  const [prevOpenId, setPrevOpenId] = React.useState(openId);
  const showArea = new Set(entries.map(entry => entry.area)).size > 1;

  if (openId !== prevOpenId) {
    setPrevOpenId(openId);
    setClosingId(prevOpenId);
  }

  if (entries.length === 0) return <ActivityEmpty />;

  return (
    <div
      aria-busy={isFetching}
      className={cn(
        "transition-opacity duration-150 motion-reduce:transition-none",
        isFetching && "opacity-60",
      )}
    >
      {/* react-doctor-disable-next-line react-doctor/prefer-tag-over-role */}
      <div
        aria-label={t("table_label")}
        className="grid grid-cols-[3rem_minmax(0,1fr)] md:grid-cols-[3rem_minmax(7rem,auto)_minmax(6rem,auto)_minmax(10rem,1.3fr)_minmax(8rem,1fr)_minmax(6rem,auto)]"
        role="table"
      >
        <div
          className="border-foreground/10 col-span-full hidden grid-cols-subgrid border-b md:grid"
          role="row"
        >
          <div className="px-3 py-2.5" role="columnheader">
            <span className="sr-only">{t("columns.details")}</span>
          </div>
          {[
            t("columns.date"),
            t("columns.actor"),
            t("columns.action"),
            t("columns.target"),
            showArea ? t("columns.area") : t("columns.plugin"),
          ].map((label, index) => (
            <div
              className={cn(
                "px-3 py-2.5 text-sm font-medium",
                index === 4 && "pe-4 sm:pe-6",
              )}
              key={label}
              role="columnheader"
            >
              {label}
            </div>
          ))}
        </div>

        {entries.map((entry, index) => {
          const isOpen = entry.id === openId;
          const isClosing = !isOpen && entry.id === closingId;
          const panelId = `${baseId}-${entry.id}`;
          const nextIsOpen = entries[index + 1]?.id === openId;

          return (
            <div
              className={cn(
                "col-span-full grid grid-cols-subgrid",
                index < entries.length - 1 && "border-b",
                isOpen || nextIsOpen
                  ? "border-transparent"
                  : "border-foreground/10",
              )}
              key={entry.id}
              onKeyDown={event => {
                if (event.key === "Escape" && isOpen) {
                  event.stopPropagation();
                  onOpenChange(null);
                }
              }}
              role="rowgroup"
            >
              <ActivityRow
                entry={entry}
                isOpen={isOpen}
                onToggle={() => {
                  onOpenChange(isOpen ? null : entry.id);
                }}
                panelId={panelId}
                plugins={plugins}
                showArea={showArea}
              />
              <div
                aria-label={t("detail.title")}
                className={cn(
                  "col-span-full grid transition-[grid-template-rows] motion-reduce:transition-none",
                  isOpen
                    ? "grid-rows-[1fr] duration-250 ease-[cubic-bezier(0.32,0.72,0,1)]"
                    : "grid-rows-[0fr] duration-180 ease-[cubic-bezier(0.4,0,1,1)]",
                )}
                id={panelId}
                inert={!isOpen}
                role="region"
              >
                <div className="min-h-0 overflow-hidden">
                  <div
                    className={cn(
                      "px-3 pt-2 pb-3 transition-opacity motion-reduce:transition-none sm:px-4",
                      isOpen && "opacity-100 delay-50 duration-200",
                      isClosing && "opacity-100",
                      !isOpen && !isClosing && "opacity-0",
                    )}
                  >
                    {isOpen || isClosing ? (
                      <div className="bg-muted/60 ring-foreground/5 rounded-lg p-4 shadow-inner ring-1 sm:ps-10">
                        <ActivityEntryPanel
                          entry={entry}
                          onFilterActor={onFilterActor}
                          plugins={plugins}
                          showArea={showArea}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <span className="sr-only" role="status">
        {isFetching ? t("loading") : ""}
      </span>
    </div>
  );
};
