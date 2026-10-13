import type {
  Announcements,
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardCoordinateGetter,
} from "@dnd-kit/core";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import {
  useQueryClient,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { cn } from "cn";
import { useReducedMotion } from "motion/react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { LayoutFlipTarget, LayoutSnapshot } from "@/lib/dnd/layout-flip";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DragLift } from "@/lib/dnd/drag-lift";
import {
  DRAG_OVERLAY_LIFT_CLASS,
  LIFTED_DROP_ANIMATION,
} from "@/lib/dnd/drag-motion";
import { playLayoutFlip, snapshotLayout } from "@/lib/dnd/layout-flip";
import { FinePointerSensor } from "@/lib/dnd/sensors";

import type { ReportState } from "../../moderation-mutations";
import type {
  ModcpBoardFilter,
  ModcpBoardReport,
  ModcpBoardStatus,
} from "../modcp-query";
import type { BoardOverride, BoardPerson } from "./board-moves";

import { assignReport, claimReport } from "../../moderation-mutations";
import {
  invalidateModcp,
  MODCP_BOARD_STATUSES,
  modcpBoardColumnQueryOptions,
} from "../modcp-query";
import { ModcpPluginMessages } from "../plugin-messages";
import {
  ReopenReportForm,
  ResolveReportForm,
  useReportFailure,
} from "../report-forms";
import { StatusLozenge } from "../report-tone";
import { BOARD_CARD_CLASS, BoardCard, BoardCardBody } from "./board-card";
import {
  boardColumns,
  columnCount,
  optimisticOverride,
  planBoardMove,
  slotIndex,
} from "./board-moves";

const COLUMN_PREFIX = "column-";

const CARDS: LayoutFlipTarget = {
  keyOf: node => node.dataset.reportCard,
  selector: "[data-report-card]",
};

const MIN_SLOT_HEIGHT = 96;

const reportIdOf = (id: number | string): null | number => {
  const match = /^report-(\d+)$/.exec(String(id));

  return match ? Number(match[1]) : null;
};

const columnStatusOf = (
  id: null | number | string | undefined,
): ModcpBoardStatus | null => {
  if (id === null || id === undefined) return null;
  const value = String(id);
  if (!value.startsWith(COLUMN_PREFIX)) return null;
  const status = value.slice(COLUMN_PREFIX.length);

  return (MODCP_BOARD_STATUSES as readonly string[]).includes(status)
    ? (status as ModcpBoardStatus)
    : null;
};

const KEYBOARD_DROP_OFFSET = 48;

const ARROW_STEP: Record<string, number> = {
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -1,
};

const columnCoordinates: KeyboardCoordinateGetter = (
  event,
  { context: { collisionRect, droppableContainers, droppableRects } },
) => {
  const step = ARROW_STEP[event.code];
  if (step === undefined || !collisionRect) return undefined;
  event.preventDefault();

  const columns = droppableContainers
    .getEnabled()
    .flatMap(container => {
      const rect = droppableRects.get(container.id);

      return rect ? [rect] : [];
    })
    .sort((left, right) => left.left - right.left || left.top - right.top);
  if (columns.length === 0) return undefined;

  const centerX = collisionRect.left + collisionRect.width / 2;
  const centerY = collisionRect.top + collisionRect.height / 2;
  const current = columns.findIndex(
    rect =>
      centerX >= rect.left &&
      centerX <= rect.left + rect.width &&
      centerY >= rect.top &&
      centerY <= rect.top + rect.height,
  );
  const target =
    columns[Math.min(columns.length - 1, Math.max(0, current + step))];
  if (!target) return undefined;

  return {
    x: target.left + (target.width - collisionRect.width) / 2,
    y: target.top + KEYBOARD_DROP_OFFSET,
  };
};

const collisionDetection: CollisionDetection = args => {
  const within = pointerWithin(args);

  return within.length > 0 ? within : rectIntersection(args);
};

type Pending = null | {
  kind: "reopen" | "resolve";
  row: ModcpBoardReport;
  to: ModcpBoardStatus;
};

const DropSlot = ({ height, hint }: { height: number; hint: string }) => (
  <li
    aria-hidden="true"
    className="border-primary/40 bg-primary/5 text-primary animate-in fade-in flex items-center justify-center rounded-lg border-2 border-dashed px-3 text-center text-xs font-medium duration-150 motion-reduce:animate-none"
    data-board-slot
    style={{ height: Math.max(height, MIN_SLOT_HEIGHT) }}
  >
    {hint}
  </li>
);

const BoardColumn = ({
  count,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onMove,
  rows,
  slot,
  status,
}: {
  count: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onMove: (row: ModcpBoardReport, to: ModcpBoardStatus) => void;
  rows: ModcpBoardReport[];
  slot: null | { height: number; hint: string; index: number };
  status: ModcpBoardStatus;
}) => {
  const t = useTranslations("core.moderation.modcp.reports.board");
  const headingId = React.useId();
  const { setNodeRef } = useDroppable({ id: `${COLUMN_PREFIX}${status}` });
  const slotElement =
    slot === null ? null : (
      <DropSlot height={slot.height} hint={slot.hint} key="board-slot" />
    );

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "bg-muted/50 flex min-w-0 flex-col gap-2 rounded-xl p-2 ring-2 ring-transparent transition-[box-shadow,background-color] duration-150 ease-out motion-reduce:transition-none",
        slot !== null && "bg-primary/5 ring-primary/20",
      )}
      ref={setNodeRef}
    >
      <h2 className="flex items-center gap-2 px-1 py-1" id={headingId}>
        <StatusLozenge status={status} />
        <span className="text-muted-foreground text-xs tabular-nums">
          {count}
        </span>
      </h2>

      {rows.length === 0 && slot === null ? (
        <p className="text-muted-foreground px-1 py-6 text-center text-sm leading-relaxed">
          {t("nothing_here")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <React.Fragment key={row.id}>
              {slot?.index === index ? slotElement : null}
              <BoardCard onMove={onMove} row={row} />
            </React.Fragment>
          ))}
          {slot !== null && slot.index >= rows.length ? slotElement : null}
        </ul>
      )}

      {hasMore ? (
        <Button
          className="self-start"
          isLoading={isLoadingMore}
          onClick={onLoadMore}
          size="sm"
          variant="ghost"
        >
          {t("show_more")}
        </Button>
      ) : null}
    </section>
  );
};

const BoardDialog = ({
  onCancel,
  onDone,
  onReopened,
  pending,
}: {
  onCancel: () => void;
  onDone: () => Promise<void>;
  onReopened: (state: ReportState) => Promise<void>;
  pending: Pending;
}) => {
  const t = useTranslations("core.moderation.modcp.detail");
  const row = pending?.row;

  return (
    <Dialog
      onOpenChange={open => {
        if (!open) onCancel();
      }}
      open={pending !== null}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {pending?.kind === "reopen"
              ? t("reopen.dialog_title", { id: row?.id ?? 0 })
              : t("resolve.dialog_title", { id: row?.id ?? 0 })}
          </DialogTitle>
          <DialogDescription>
            {pending?.kind === "reopen"
              ? t("reopen.dialog_desc")
              : t("resolve.success_desc")}
          </DialogDescription>
        </DialogHeader>
        {row === undefined ? null : pending?.kind === "reopen" ? (
          <ReopenReportForm
            expectedVersion={row.version}
            id={row.id}
            onDone={onDone}
            onReopened={onReopened}
          />
        ) : (
          <ResolveReportForm
            expectedVersion={row.version}
            id={row.id}
            onDone={onDone}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export const ModcpReportsBoard = ({
  filter,
  me,
}: {
  filter: ModcpBoardFilter;
  me: BoardPerson;
}) => {
  const t = useTranslations("core.moderation");
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const fail = useReportFailure();
  const newColumn = useSuspenseInfiniteQuery(
    modcpBoardColumnQueryOptions("new", filter),
  );
  const progressColumn = useSuspenseInfiniteQuery(
    modcpBoardColumnQueryOptions("in_progress", filter),
  );
  const doneColumn = useSuspenseInfiniteQuery(
    modcpBoardColumnQueryOptions("done", filter),
  );
  const queries = {
    done: doneColumn,
    in_progress: progressColumn,
    new: newColumn,
  };

  const [overrides, setOverrides] = React.useState<
    ReadonlyMap<number, BoardOverride>
  >(() => new Map());
  const [activeId, setActiveId] = React.useState<null | number>(null);
  const [overStatus, setOverStatus] = React.useState<ModcpBoardStatus | null>(
    null,
  );
  const [dragHeight, setDragHeight] = React.useState(0);
  const [pending, setPending] = React.useState<Pending>(null);
  const boardRef = React.useRef<HTMLDivElement>(null);
  const flipFromRef = React.useRef<LayoutSnapshot | null>(null);

  const loaded = {
    done: doneColumn.data.pages.flatMap(page => page.items),
    in_progress: progressColumn.data.pages.flatMap(page => page.items),
    new: newColumn.data.pages.flatMap(page => page.items),
  };
  const columns = boardColumns({ loaded, overrides });
  const allRows = [...columns.new, ...columns.in_progress, ...columns.done];
  const active =
    activeId === null
      ? null
      : (allRows.find(row => row.id === activeId) ?? null);

  const prepareFlip = () => {
    if (reduceMotion) return;
    flipFromRef.current ??= snapshotLayout(boardRef.current, CARDS);
  };

  React.useLayoutEffect(() => {
    playLayoutFlip(boardRef.current, flipFromRef.current, CARDS);
    flipFromRef.current = null;
  });

  const setOverride = (id: number, next: BoardOverride | null) => {
    prepareFlip();
    setOverrides(current => {
      const copy = new Map(current);
      if (next === null) copy.delete(id);
      else copy.set(id, next);

      return copy;
    });
  };

  const settle = async (id: number) => {
    await invalidateModcp(queryClient);
    setOverride(id, null);
  };

  const hintFor = (from: ModcpBoardStatus, to: ModcpBoardStatus): string => {
    const plan = planBoardMove(from, to);
    if (plan?.kind === "claim") return t("modcp.reports.board.hint_take");
    if (plan?.kind === "unassign") {
      return t("modcp.reports.board.hint_unassign");
    }
    if (plan?.kind === "resolve") return t("modcp.reports.board.hint_close");

    return t("modcp.reports.board.hint_reopen");
  };

  const move = async (row: ModcpBoardReport, to: ModcpBoardStatus) => {
    const plan = planBoardMove(row.status, to);
    if (plan === null) return;

    setOverride(row.id, optimisticOverride({ me, row, to }));

    if (plan.kind === "resolve" || plan.kind === "reopen") {
      setPending({ kind: plan.kind, row, to });

      return;
    }

    const result =
      plan.kind === "claim"
        ? await claimReport({ expectedVersion: row.version, id: row.id })
        : await assignReport({
            assigneeId: null,
            expectedVersion: row.version,
            id: row.id,
          });

    if (!fail(result)) {
      if (plan.kind === "claim") {
        toast.success(t("modcp.detail.assignment.claimed"), {
          description: t("modcp.detail.assignment.claimed_desc"),
        });
      } else {
        toast.success(t("modcp.reports.board.unassigned"), {
          description: t("modcp.reports.board.unassigned_desc"),
        });
      }
    }
    await settle(row.id);
  };

  const onReopened = async (state: ReportState) => {
    if (pending === null) return;
    const { row, to } = pending;
    if (to === "in_progress" && state.status === "new") {
      fail(await claimReport({ expectedVersion: state.version, id: row.id }));
    }
    if (to === "new" && state.status === "in_progress") {
      fail(
        await assignReport({
          assigneeId: null,
          expectedVersion: state.version,
          id: row.id,
        }),
      );
    }
  };

  const sensors = useSensors(
    useSensor(FinePointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinates }),
  );

  const statusName = (status: ModcpBoardStatus) => t(`statuses.${status}`);

  const announcements: Announcements = {
    onDragCancel: ({ active: dragged }) =>
      t("modcp.reports.board.dnd.cancelled", {
        id: reportIdOf(dragged.id) ?? 0,
      }),
    onDragEnd: ({ active: dragged, over }) => {
      const status = columnStatusOf(over?.id);
      const id = reportIdOf(dragged.id) ?? 0;

      return status === null
        ? t("modcp.reports.board.dnd.cancelled", { id })
        : t("modcp.reports.board.dnd.dropped", {
            column: statusName(status),
            id,
          });
    },
    onDragOver: ({ active: dragged, over }) => {
      const status = columnStatusOf(over?.id);
      const id = reportIdOf(dragged.id) ?? 0;

      return status === null
        ? t("modcp.reports.board.dnd.outside", { id })
        : t("modcp.reports.board.dnd.over", {
            column: statusName(status),
            id,
          });
    },
    onDragStart: ({ active: dragged }) =>
      t("modcp.reports.board.dnd.picked_up", {
        id: reportIdOf(dragged.id) ?? 0,
      }),
  };

  const onDragStart = ({ active: dragged }: DragStartEvent) => {
    setActiveId(reportIdOf(dragged.id));
    setDragHeight(dragged.rect.current.initial?.height ?? 0);
  };

  const onDragOver = ({ active: dragged, over }: DragOverEvent) => {
    const status = columnStatusOf(over?.id);
    const height = dragged.rect.current.initial?.height ?? 0;
    if (height !== dragHeight) setDragHeight(height);
    if (status === overStatus) return;
    prepareFlip();
    setOverStatus(status);
  };

  const reset = () => {
    prepareFlip();
    setActiveId(null);
    setOverStatus(null);
  };

  const onDragEnd = ({ over }: DragEndEvent) => {
    const status = columnStatusOf(over?.id);
    const row = active;
    reset();
    if (row !== null && status !== null) void move(row, status);
  };

  const showsSlot =
    active !== null && overStatus !== null && overStatus !== active.status;

  return (
    <ModcpPluginMessages labels={allRows.map(row => row.targetLabel)}>
      <DndContext
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable: t("modcp.reports.board.dnd.instructions"),
          },
        }}
        collisionDetection={collisionDetection}
        id="vitnode-modcp-board"
        modifiers={[restrictToWindowEdges]}
        onDragCancel={reset}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragStart={onDragStart}
        sensors={sensors}
      >
        <div className="grid items-start gap-3 md:grid-cols-3" ref={boardRef}>
          {MODCP_BOARD_STATUSES.map(status => {
            const query = queries[status];
            const rows = columns[status];

            return (
              <BoardColumn
                count={columnCount({
                  loaded,
                  overrides,
                  status,
                  total: query.data.pages[0]?.total ?? 0,
                })}
                hasMore={query.hasNextPage}
                isLoadingMore={query.isFetchingNextPage}
                key={status}
                onLoadMore={() => {
                  void query.fetchNextPage();
                }}
                onMove={(row, to) => {
                  void move(row, to);
                }}
                rows={rows}
                slot={
                  showsSlot && overStatus === status
                    ? {
                        height: dragHeight,
                        hint: hintFor(active.status, status),
                        index: slotIndex(rows, active),
                      }
                    : null
                }
                status={status}
              />
            );
          })}
        </div>

        <DragOverlay
          dropAnimation={reduceMotion ? null : LIFTED_DROP_ANIMATION}
        >
          {active === null ? null : (
            <DragLift>
              <div
                className={cn(
                  BOARD_CARD_CLASS,
                  "size-full overflow-hidden",
                  DRAG_OVERLAY_LIFT_CLASS,
                )}
              >
                <BoardCardBody row={active} />
              </div>
            </DragLift>
          )}
        </DragOverlay>

        <BoardDialog
          onCancel={() => {
            if (pending !== null) setOverride(pending.row.id, null);
            setPending(null);
          }}
          onDone={async () => {
            const id = pending?.row.id;
            setPending(null);
            if (id !== undefined) await settle(id);
          }}
          onReopened={onReopened}
          pending={pending}
        />
      </DndContext>
    </ModcpPluginMessages>
  );
};
