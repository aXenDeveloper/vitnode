import type { Announcements } from "@dnd-kit/core";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDndMonitor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import { GripVerticalIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { DataTableTMin } from "./data-table-content";

import { Button } from "../ui/button";
import { moveRowId, type ReorderDetailsDataTable } from "./reorder-state";

export interface ReorderableDataTable<T> {
  disabled?: boolean;
  getRowLabel?: (row: T) => string;
  onReorder: (
    ids: number[],
    details: ReorderDetailsDataTable,
  ) => Promise<void> | void;
}

interface RowOrderOverride {
  ids: number[];
  key: string;
}

export const useRowOrderDataTable = <T extends DataTableTMin>({
  edges,
  onReorder,
}: {
  edges: T[];
  onReorder?: ReorderableDataTable<T>["onReorder"];
}) => {
  const t = useTranslations("core.global.data_table");
  const serverIds = edges.map(row => row.id);
  const serverKey = serverIds.join(",");
  const [override, setOverride] = React.useState<null | RowOrderOverride>(null);
  const ids = override?.key === serverKey ? override.ids : serverIds;
  const byId = new Map(edges.map(row => [row.id, row]));
  const rows = ids.flatMap(id => {
    const row = byId.get(id);

    return row ? [row] : [];
  });

  const reorder = (activeId: number, overId: number) => {
    const move = moveRowId(ids, activeId, overId);
    if (!move || !onReorder) return;

    const attempt: RowOrderOverride = { ids: move.ids, key: serverKey };
    const previous = override;
    setOverride(attempt);

    const persist = async () => {
      try {
        await onReorder(move.ids, {
          activeId: move.activeId,
          from: move.from,
          overId: move.overId,
          to: move.to,
        });
      } catch {
        setOverride(current => (current === attempt ? previous : current));
        toast.error(t("reorder_failed"), {
          description: t("reorder_failed_desc"),
        });
      }
    };

    void persist();
  };

  return { reorder, rows };
};

const SETTLE_DURATION = 200;
const SETTLE_EASING = "cubic-bezier(0.25, 1, 0.5, 1)";

const subscribeToNothing = () => () => undefined;
const getAnnouncementContainer = () => document.body;
const getNoAnnouncementContainer = () => null;

const SortableRowHandleContext = React.createContext<null | React.ReactElement>(
  null,
);

export function ReorderProviderDataTable({
  children,
  ids,
  labelOf,
  onMove,
}: {
  children: React.ReactNode;
  ids: number[];
  labelOf: (id: number) => string | undefined;
  onMove: (activeId: number, overId: number) => void;
}) {
  const t = useTranslations("core.global.data_table");
  const contextId = React.useId();
  const announcementContainer = React.useSyncExternalStore(
    subscribeToNothing,
    getAnnouncementContainer,
    getNoAnnouncementContainer,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const spoken = (activeId: number, overId: number) => ({
    name:
      labelOf(activeId) ??
      t("row_fallback", { position: ids.indexOf(activeId) + 1 }),
    position: ids.indexOf(overId) + 1,
    total: ids.length,
  });

  const announcements: Announcements = {
    onDragCancel: ({ active }) =>
      t("reorder_cancelled", spoken(Number(active.id), Number(active.id))),
    onDragEnd: ({ active, over }) =>
      over
        ? t("reorder_ended", spoken(Number(active.id), Number(over.id)))
        : undefined,
    onDragOver: ({ active, over }) =>
      over
        ? t("reorder_over", spoken(Number(active.id), Number(over.id)))
        : undefined,
    onDragStart: ({ active }) =>
      t("reorder_started", spoken(Number(active.id), Number(active.id))),
  };

  return (
    <DndContext
      accessibility={{
        announcements,
        container: announcementContainer ?? undefined,
        screenReaderInstructions: { draggable: t("reorder_instructions") },
      }}
      collisionDetection={closestCenter}
      id={contextId}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={({ active, over }) => {
        if (over) onMove(Number(active.id), Number(over.id));
      }}
      sensors={sensors}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export function SortableRowGroupDataTable({
  children,
  disabled,
  id,
  label,
  position,
}: {
  children: React.ReactNode;
  disabled: boolean;
  id: number;
  label?: string;
  position: number;
}) {
  const t = useTranslations("core.global.data_table");
  const name = label ?? t("row_fallback", { position });
  const shouldReduceMotion = useReducedMotion();
  const {
    attributes,
    isDragging,
    listeners,
    node: nodeRef,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    disabled,
    id,
    transition: shouldReduceMotion
      ? null
      : { duration: SETTLE_DURATION, easing: SETTLE_EASING },
  });
  const dropRectRef = React.useRef<DOMRect | null>(null);

  useDndMonitor({
    onDragEnd: ({ active }) => {
      if (active.id === id && nodeRef.current) {
        dropRectRef.current = nodeRef.current.getBoundingClientRect();
      }
    },
  });

  React.useLayoutEffect(() => {
    const from = dropRectRef.current;
    const element = nodeRef.current;
    if (!from || !element) return;

    dropRectRef.current = null;
    if (shouldReduceMotion) return;

    const deltaY = from.top - element.getBoundingClientRect().top;
    if (Math.abs(deltaY) < 1) return;

    element.animate(
      [
        { transform: `translate3d(0, ${deltaY}px, 0)` },
        { transform: "translate3d(0, 0, 0)" },
      ],
      { duration: SETTLE_DURATION, easing: SETTLE_EASING },
    );
  });

  const handleLabel = t("reorder_row", { name });
  const handle = disabled ? (
    <Button
      aria-label={handleLabel}
      className="-ms-1.5"
      disabled
      disabledTooltip={t("reorder_unavailable")}
      size="icon-sm"
      variant="ghost"
    >
      <GripVerticalIcon aria-hidden="true" />
    </Button>
  ) : (
    <Button
      aria-label={handleLabel}
      className="-ms-1.5 cursor-grab touch-none active:cursor-grabbing"
      data-slot="table-drag-handle"
      ref={setActivatorNodeRef}
      size="icon-sm"
      variant="ghost"
      {...attributes}
      {...listeners}
    >
      <GripVerticalIcon aria-hidden="true" />
    </Button>
  );

  return (
    <SortableRowHandleContext.Provider value={handle}>
      <tbody
        className={cn(
          "[&:last-child>tr:last-child]:border-0 [&:last-child>tr:last-child>td]:border-b-0 [&>tr>td]:border-b",
          isDragging &&
            "bg-card ring-foreground/10 relative z-10 shadow-lg ring-1",
        )}
        data-dragging={isDragging ? "" : undefined}
        data-slot="table-row-group"
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition }}
      >
        {children}
      </tbody>
    </SortableRowHandleContext.Provider>
  );
}

export function ReorderHeaderDataTable() {
  const t = useTranslations("core.global.data_table");

  return <span className="sr-only">{t("reorder_column")}</span>;
}

export function ReorderHandleDataTable() {
  return React.use(SortableRowHandleContext);
}
