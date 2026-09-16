import type { CSSProperties } from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useVisualEditor } from "../context";

export interface SortableBlock {
  dragging: boolean;
  handleProps: Record<string, unknown>;
  setNodeRef: (node: HTMLElement | null) => void;
  style: CSSProperties;
}

export const useSortableBlock = ({
  blockId,
  index,
  zoneId,
}: {
  blockId: string;
  index: number;
  zoneId: string;
}): SortableBlock => {
  const { preview, state } = useVisualEditor();
  const type =
    state.zones[zoneId]?.blocks.find(block => block.id === blockId)?.type ?? "";

  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    data: { index, kind: "existing-block", type, zoneId },
    disabled: preview,
    id: blockId,
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
