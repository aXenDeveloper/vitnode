import type { CSSProperties } from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useReducedMotion } from "motion/react";

import type { EditorNodeRef } from "../state/types";

import { DRAG_SHIFT_TRANSITION } from "../../lib/dnd/drag-motion";
import { useVisualEditor } from "../context";
import { nodeDraggableId } from "./resolve-drop";

export interface SortableNode {
  activatorProps: Record<string, unknown>;
  dragging: boolean;
  dragListeners: Record<string, unknown>;
  setNodeRef: (node: HTMLElement | null) => void;
  style: CSSProperties;
}

export const useSortableNode = ({
  childTypes,
  index,
  nodeRef,
  type,
}: {
  childTypes?: readonly string[];
  index: number;
  nodeRef: EditorNodeRef;
  type: string | undefined;
}): SortableNode => {
  const { preview } = useVisualEditor();
  const reduceMotion = useReducedMotion();

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
      areaId: nodeRef.areaId,
      childTypes,
      index,
      kind: nodeRef.kind === "area" ? "existing-area" : "existing-block",
      nodeId: nodeRef.nodeId,
      type,
      zoneId: nodeRef.zoneId,
    },
    disabled: preview,
    id: nodeDraggableId(nodeRef),
    transition: reduceMotion ? null : DRAG_SHIFT_TRANSITION,
  });

  return {
    activatorProps: { ...attributes, ref: setActivatorNodeRef },
    dragging: isDragging,
    dragListeners: listeners ?? {},
    setNodeRef,
    style: {
      transform: CSS.Translate.toString(transform),
      transition,
    },
  };
};
