import type { CSSProperties } from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { EditorBlockRef } from "../state/types";

import { useVisualEditor } from "../context";
import { blockDraggableId } from "./resolve-drop";

export interface SortableBlock {
  dragging: boolean;
  handleProps: Record<string, unknown>;
  setNodeRef: (node: HTMLElement | null) => void;
  style: CSSProperties;
}

export const useSortableBlock = ({
  index,
  ref,
}: {
  index: number;
  ref: EditorBlockRef;
}): SortableBlock => {
  const { preview, state } = useVisualEditor();
  const type =
    state.zones[ref.zoneId]?.blocks.find(block => block.id === ref.blockId)
      ?.type ?? "";

  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    data: {
      blockId: ref.blockId,
      index,
      kind: "existing-block",
      type,
      zoneId: ref.zoneId,
    },
    disabled: preview,
    id: blockDraggableId(ref),
  });

  return {
    dragging: isDragging,
    handleProps: {
      ...attributes,
      ...listeners,
      ref: setActivatorNodeRef,
    },
    setNodeRef,
    style: {
      transform: CSS.Translate.toString(transform),
      transition,
    },
  };
};
