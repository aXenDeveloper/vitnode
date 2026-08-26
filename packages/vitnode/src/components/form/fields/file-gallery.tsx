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
import { useTranslations } from "next-intl";

import { AttachmentAction } from "@/components/ui/attachment";
import { cn } from "@/lib/utils";

import type { AutoFormFileValue } from "./file-shared";

import { moveFileId } from "./file-order";
import { FileCard, FileCardSkeleton } from "./file-shared";

/** One row of the gallery: a file the form holds, or an upload still running. */
export type FileGalleryRow =
  | {
      /** The descriptor, or `null` when only the identifier is known. */
      file: AutoFormFileValue | null;
      id: number;
      kind: "file";
    }
  | { kind: "pending"; name: string; order: number; size: number };

export interface FileGalleryProps {
  /** False when the field's `min` would be broken by taking one away. */
  canRemove: boolean;
  onRemove: (id: number) => void;
  /** The whole new identifier list, in the order it was dropped in. */
  onReorder: (ids: number[]) => void;
  /**
   * Whether the order is the author's to choose.
   *
   * Straight off `field.file({ ordered })`. A field that stores its entries by
   * ascending `core_files.id` must not offer a handle that appears to do
   * something and is then normalised away by the save.
   */
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
      // A field with `min: 2` cannot be taken to one by clicking: the save would
      // be refused, and refusing the click says so before the bandwidth and the
      // version are spent.
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <XIcon />
    </AttachmentAction>
  );
};

/**
 * The identifiers a drop leaves behind, or `null` when nothing moved.
 *
 * Exported and separate from the context that calls it because it is the only
 * part of a drag with a *value* in it: everything else - the sensors, the
 * collision detection, the transform on the card - is how the gesture felt, and
 * this is what it did. A drop outside the list, or onto the row it started from,
 * changes nothing and must not write to the form: an `onChange` with the same
 * array is still a dirty form and still an unsaved-changes prompt.
 */
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

/**
 * One stored file, draggable by its handle.
 *
 * The handle is a real `<button>` and the **only** drag target, which is the
 * whole reason it exists: dnd-kit's listeners on the card would swallow the
 * click that removes it, and a card that is one big grab target has no keyboard
 * affordance and no name to announce. The handle carries dnd-kit's own
 * `attributes` - `aria-roledescription`, the instructions it is described by,
 * and the keyboard entry point - so space picks the row up and the arrow keys
 * move it.
 */
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

/**
 * The files a collection holds, with the ones still uploading in their places.
 *
 * Two things it is careful about, because both are ways a list can lie:
 *
 * - **A placeholder is never a file.** An upload in flight has no
 *   `core_files.id` to sort by and nothing to save, so it is rendered where it
 *   will land and left out of the sortable set entirely. Dragging one would be
 *   dragging something that does not exist yet.
 * - **The order it shows is the order that will be saved.** A drop rewrites
 *   `field.value` immediately and nothing else - there is no local arrangement
 *   kept beside the form for a reset to disagree with.
 *
 * The handles appear only once there are two files, because reordering one file
 * is not a thing anybody can do, and a control that does nothing is worse than
 * no control.
 */
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
    // A short threshold, so a handle that is pressed rather than dragged still
    // behaves like a button.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Hold-to-drag on touch, so the page still scrolls normally.
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
  /** Who moved, and to which of how many places - the three every line needs. */
  const spoken = (activeId: number, overId: number) => ({
    name: nameOf(activeId),
    position: ids.indexOf(overId) + 1,
    total: ids.length,
  });

  // dnd-kit's own announcements are in English and say "sortable item". These
  // name the file and the place it landed, in the reader's own language.
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
            // Keyed by its queue slot, which is monotonic and never reused - an
            // index would hand the next file this card the moment this one
            // settles, and its skeleton would flash where the thumbnail is.
            <li key={`pending-${row.order}`}>
              <FileCardSkeleton
                leading={
                  // The width a handle would take, so the thumbnails stay in a
                  // column while a card in the middle of the list is uploading.
                  isSortable ? <span className="size-7" /> : undefined
                }
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
            {/*
              An entry with no descriptor still gets a card: "there is a file
              here and I cannot describe it" must not look like the gallery
              being one shorter than it is.
            */}
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
