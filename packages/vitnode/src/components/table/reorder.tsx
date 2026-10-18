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
import { useTranslations } from "use-intl";

import type { DataTableRowId } from "./data-table-content";

import { Button } from "../ui/button";
import { ROW_GROUP_CLASS, SortableRowHandleContext } from "./reorder-handle";

// Everything that needs dnd-kit lives in this module, which the table loads
// lazily and only when `reorderable` is set.

const SETTLE_DURATION = 200;
const SETTLE_EASING = "cubic-bezier(0.25, 1, 0.5, 1)";

const subscribeToNothing = () => () => undefined;
const getAnnouncementContainer = () => document.body;
const getNoAnnouncementContainer = () => null;

/** The drag-and-drop context for one page of sortable rows. */
export function ReorderProviderDataTable({
  children,
  ids,
  labelOf,
  onMove,
}: {
  children: React.ReactNode;
  ids: DataTableRowId[];
  labelOf: (id: DataTableRowId) => string | undefined;
  onMove: (activeId: DataTableRowId, overId: DataTableRowId) => void;
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

  const spoken = (activeId: DataTableRowId, overId: DataTableRowId) => ({
    name:
      labelOf(activeId) ??
      t("row_fallback", { position: ids.indexOf(activeId) + 1 }),
    position: ids.indexOf(overId) + 1,
    total: ids.length,
  });

  const announcements: Announcements = {
    onDragCancel: ({ active }) =>
      t("reorder_cancelled", spoken(active.id, active.id)),
    onDragEnd: ({ active, over }) =>
      over ? t("reorder_ended", spoken(active.id, over.id)) : undefined,
    onDragOver: ({ active, over }) =>
      over ? t("reorder_over", spoken(active.id, over.id)) : undefined,
    onDragStart: ({ active }) =>
      t("reorder_started", spoken(active.id, active.id)),
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
        if (over) onMove(active.id, over.id);
      }}
      sensors={sensors}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** One sortable row (a `tbody`, so an expanded panel moves with it), providing its handle. */
export function SortableRowGroupDataTable({
  children,
  disabled,
  id,
  label,
  position,
}: {
  children: React.ReactNode;
  disabled: boolean;
  id: DataTableRowId;
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
    <SortableRowHandleContext value={handle}>
      <tbody
        className={cn(
          ROW_GROUP_CLASS,
          isDragging &&
            "bg-card ring-foreground/10 relative z-10 shadow-lg ring-1 motion-safe:scale-101",
        )}
        data-dragging={isDragging ? "" : undefined}
        data-slot="table-row-group"
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition }}
      >
        {children}
      </tbody>
    </SortableRowHandleContext>
  );
}

interface ReorderableRowDataTable {
  content: React.ReactNode;
  id: DataTableRowId;
  label?: string;
}

export const ReorderableBodyDataTable = ({
  disabled,
  onMove,
  rows,
}: {
  disabled: boolean;
  onMove: (activeId: DataTableRowId, overId: DataTableRowId) => void;
  rows: ReorderableRowDataTable[];
}) => (
  <ReorderProviderDataTable
    ids={rows.map(row => row.id)}
    labelOf={id => rows.find(row => row.id === id)?.label}
    onMove={onMove}
  >
    {rows.map((row, index) => (
      <SortableRowGroupDataTable
        disabled={disabled}
        id={row.id}
        key={row.id}
        label={row.label}
        position={index + 1}
      >
        {row.content}
      </SortableRowGroupDataTable>
    ))}
  </ReorderProviderDataTable>
);
