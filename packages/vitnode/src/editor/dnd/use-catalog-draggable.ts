import { useDraggable } from "@dnd-kit/core";

import { useVisualEditor } from "../context";
import { catalogDraggableId } from "./resolve-drop";

export interface CatalogDraggable {
  dragging: boolean;
  handleProps: Record<string, unknown>;
  setNodeRef: (node: HTMLElement | null) => void;
}

export const useCatalogDraggable = ({
  type,
}: {
  type: string;
}): CatalogDraggable => {
  const { preview } = useVisualEditor();
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    data: { kind: "catalog-block", type },
    disabled: preview,
    id: catalogDraggableId(type),
  });

  const { onKeyDown: _keyboardActivator, ...pointerListeners } =
    listeners ?? {};

  return {
    dragging: isDragging,
    handleProps: { ...attributes, ...pointerListeners },
    setNodeRef,
  };
};
