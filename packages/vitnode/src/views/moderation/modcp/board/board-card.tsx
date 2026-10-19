import { useDraggable } from "@dnd-kit/core";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { FlagIcon, GripVerticalIcon, MoreHorizontalIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { ReportReasonLabel } from "@/views/moderation/report-reason-label";

import type { ModcpBoardReport, ModcpBoardStatus } from "../modcp-query";

import { MODCP_BOARD_STATUSES } from "../modcp-query";
import {
  Chip,
  Person,
  REASON_TONE,
  StatusLozenge,
  TONE_SURFACE,
} from "../report-tone";
import { useTargetLabel } from "../status-badge";

export const BOARD_CARD_CLASS =
  "bg-card text-card-foreground ring-foreground/10 relative flex flex-col gap-2 rounded-lg p-3 shadow-xs ring-1";

export const boardCardId = (id: number): string => `report-${id}`;

const ExtraReports = ({ row }: { row: ModcpBoardReport }) => {
  const t = useTranslations("core.moderation.modcp.reports.board");
  if (row.relatedCount === 0) return null;

  return (
    <TooltipWithContent text={t("extra_reports", { count: row.relatedCount })}>
      <span
        aria-label={t("extra_reports", { count: row.relatedCount })}
        className={cn(
          "relative z-10 inline-flex h-6 items-center rounded-full px-2 text-xs font-medium tabular-nums",
          TONE_SURFACE[REASON_TONE],
        )}
        role="img"
      >
        +{row.relatedCount}
      </span>
    </TooltipWithContent>
  );
};

const CardMenu = ({
  onMove,
  row,
}: {
  onMove: (row: ModcpBoardReport, to: ModcpBoardStatus) => void;
  row: ModcpBoardReport;
}) => {
  const t = useTranslations("core.moderation.modcp");

  return (
    <span
      className="relative z-10 -me-1 -mt-1"
      onPointerDown={event => {
        event.stopPropagation();
      }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("reports.board.actions", { id: row.id })}
              className="text-muted-foreground"
              size="icon-xs"
              variant="ghost"
            />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>{t("detail.status.move_to")}</DropdownMenuLabel>
          {MODCP_BOARD_STATUSES.filter(status => status !== row.status).map(
            status => (
              <DropdownMenuItem
                key={status}
                onClick={() => {
                  onMove(row, status);
                }}
              >
                <StatusLozenge status={status} />
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
};

export const BoardCardBody = ({
  handle,
  onMove,
  row,
}: {
  handle?: React.ReactNode;
  onMove?: (row: ModcpBoardReport, to: ModcpBoardStatus) => void;
  row: ModcpBoardReport;
}) => {
  const t = useTranslations("core.moderation");
  const targetLabel = useTargetLabel();
  const title = row.title ?? t("modcp.reports.untitled");

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1">
          <Chip icon={FlagIcon} tone={REASON_TONE}>
            <ReportReasonLabel code={row.reason} />
          </Chip>
          <ExtraReports row={row} />
        </span>
        <span className="flex shrink-0 items-center">
          {handle}
          {onMove ? <CardMenu onMove={onMove} row={row} /> : null}
        </span>
      </div>

      {onMove ? (
        <Link
          className="text-foreground focus-visible:ring-ring/50 line-clamp-2 rounded-sm text-sm leading-snug font-medium outline-none after:absolute after:inset-0 focus-visible:ring-3"
          draggable={false}
          to={`/modcp/reports/${row.id}`}
        >
          {title}
        </Link>
      ) : (
        <span className="text-foreground line-clamp-2 text-sm leading-snug font-medium">
          {title}
        </span>
      )}

      <p className="text-muted-foreground text-xs tabular-nums">
        #{row.id} · {targetLabel(row.targetLabel, row.targetType)}
      </p>

      <div className="flex items-center gap-2">
        <span className="relative z-10 flex min-w-0 text-sm">
          {row.assignee ? (
            <Person person={row.assignee} />
          ) : (
            <TooltipWithContent text={t("modcp.reports.unassigned")}>
              <span
                aria-label={t("modcp.reports.unassigned")}
                className="flex size-6 shrink-0 rounded-full border border-dashed"
                role="img"
              />
            </TooltipWithContent>
          )}
        </span>
        <span className="text-muted-foreground ms-auto shrink-0 text-xs">
          <DateFormat date={row.createdAt} />
        </span>
      </div>
    </>
  );
};

export const BoardCard = ({
  onMove,
  row,
}: {
  onMove: (row: ModcpBoardReport, to: ModcpBoardStatus) => void;
  row: ModcpBoardReport;
}) => {
  const t = useTranslations("core.moderation.modcp.reports.board");
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef } =
    useDraggable({ data: { reportId: row.id }, id: boardCardId(row.id) });

  return (
    <li
      className={cn(
        BOARD_CARD_CLASS,
        "group/card hover:ring-foreground/20 focus-within:ring-ring/50 cursor-grab touch-manipulation transition-shadow duration-150 select-none active:cursor-grabbing",
        isDragging &&
          "bg-primary/5 outline-primary/50 shadow-none ring-0 outline-2 -outline-offset-2 outline-dashed *:opacity-0",
      )}
      data-report-card={row.id}
      ref={setNodeRef}
      style={{ WebkitTouchCallout: "none" }}
      {...listeners}
    >
      <BoardCardBody
        handle={
          <button
            {...attributes}
            aria-label={t("drag", { id: row.id })}
            className="text-muted-foreground/60 hover:text-foreground focus-visible:ring-ring/50 relative z-10 -mt-1 flex size-6 shrink-0 cursor-grab items-center justify-center rounded-sm opacity-0 transition-opacity duration-150 outline-none group-hover/card:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 active:cursor-grabbing max-md:hidden"
            ref={setActivatorNodeRef}
            type="button"
          >
            <GripVerticalIcon aria-hidden="true" className="size-4" />
          </button>
        }
        onMove={onMove}
        row={row}
      />
    </li>
  );
};
