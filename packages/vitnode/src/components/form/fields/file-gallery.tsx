"use client";

import type { Announcements, UniqueIdentifier } from "@dnd-kit/core";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
import { GripVerticalIcon, XIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { AttachmentAction } from "@/components/ui/attachment";
import { cn } from "@/lib/utils";

import type { AutoFormFileValue } from "./file-shared";

import { moveFileId } from "./file-order";
import { FileCard, FileCardSkeleton } from "./file-shared";

/** One row of the gallery: a file the form holds, or an upload still running. */
export type FileGalleryRow =
  | {
      file: AutoFormFileValue | null;
      id: number;
      kind: "file";
    }
  | { kind: "pending"; name: string; order: number; size: number };

export interface FileGalleryProps {
  canRemove: boolean;
  onRemove: (id: number) => void;
  onReorder: (ids: number[]) => void;
  ordered: boolean;
  rows: FileGalleryRow[];
}

const dragHandleClassName =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -ms-0.5 flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing";

/** What the row is called out loud: the file's name, or that it has none. */
const useRowName = () => {
  const t = useTranslations("core.global.file");

  return (row: FileGalleryRow): string =>
    row.kind === "pending" ? row.name : (row.file?.name ?? t("stored"));
};

const RemoveAction = ({
  disabled,
  name,
  onClick,
}: {
  disabled: boolean;
  name: string;
  onClick: () => void;
}) => {
  const t = useTranslations("core.global.file");

  return (
    <AttachmentAction
      aria-label={t("remove_named", { name })}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <XIcon />
    </AttachmentAction>
  );
};

export const fileGalleryDrop = (
  ids: readonly number[],
  {
    active,
    over,
  }: {
    active: { id: UniqueIdentifier };
    over: null | { id: UniqueIdentifier };
  },
): null | number[] => {
  if (!over || active.id === over.id) return null;

  const next = moveFileId(ids, Number(active.id), Number(over.id));

  return next.some((id, at) => id !== ids[at]) ? next : null;
};

const SortableFileRow = ({
  file,
  id,
  name,
  onRemove,
  removable,
}: {
  file: AutoFormFileValue | null;
  id: number;
  name: string;
  onRemove: () => void;
  removable: boolean;
}) => {
  const t = useTranslations("core.global.file");
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  return (
    <li
      className={cn("relative", isDragging && "z-10 opacity-70")}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <FileCard
        file={file ?? { id, name, size: 0, url: "" }}
        leading={
          <button
            aria-label={t("reorder", { name })}
            className={dragHandleClassName}
            data-slot="file-drag-handle"
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon aria-hidden className="size-4" />
          </button>
        }
      >
        <RemoveAction disabled={!removable} name={name} onClick={onRemove} />
      </FileCard>
    </li>
  );
};

export const FileGallery = ({
  canRemove,
  onRemove,
  onReorder,
  ordered,
  rows,
}: FileGalleryProps) => {
  const t = useTranslations("core.global.file");
  const rowName = useRowName();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const ids = rows.flatMap(row => (row.kind === "file" ? [row.id] : []));
  const isSortable = ordered && ids.length > 1;

  const nameOf = (id: number): string => {
    const row = rows.find(entry => entry.kind === "file" && entry.id === id);

    return row ? rowName(row) : t("stored");
  };
  const spoken = (activeId: number, overId: number) => ({
    name: nameOf(activeId),
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

  const list = (
    <ul className="flex flex-col gap-2" data-slot="file-list">
      {rows.map(row => {
        const name = rowName(row);

        if (row.kind === "pending") {
          return (
            <li key={`pending-${row.order}`}>
              <FileCardSkeleton
                leading={isSortable ? <span className="size-7" /> : undefined}
                name={row.name}
                size={row.size}
              />
            </li>
          );
        }

        if (isSortable) {
          return (
            <SortableFileRow
              file={row.file}
              id={row.id}
              key={row.id}
              name={name}
              onRemove={() => onRemove(row.id)}
              removable={canRemove}
            />
          );
        }

        return (
          <li key={row.id}>
            <FileCard file={row.file ?? { id: row.id, name, size: 0, url: "" }}>
              <RemoveAction
                disabled={!canRemove}
                name={name}
                onClick={() => onRemove(row.id)}
              />
            </FileCard>
          </li>
        );
      })}
    </ul>
  );

  if (!isSortable) return list;

  return (
    <DndContext
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t("reorder_instructions") },
      }}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={event => {
        const next = fileGalleryDrop(ids, event);
        if (next) onReorder(next);
      }}
      sensors={sensors}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {list}
      </SortableContext>
    </DndContext>
  );
};
