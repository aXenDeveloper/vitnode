import { useDraggable } from "@dnd-kit/core";

import { useVisualEditor } from "../context";
import { AREA_CATALOG_DRAGGABLE_ID, catalogDraggableId } from "./resolve-drop";

export interface CatalogDraggable {
  dragging: boolean;
  handleProps: Record<string, unknown>;
  setNodeRef: (node: HTMLElement | null) => void;
}

const useCatalogEntryDraggable = ({
  data,
  id,
}: {
  data: Record<string, unknown>;
  id: string;
}): CatalogDraggable => {
  const { preview } = useVisualEditor();
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    data,
    disabled: preview,
    id,
  });

  const { onKeyDown: _keyboardActivator, ...pointerListeners } =
    listeners ?? {};

  return {
    dragging: isDragging,
    handleProps: { ...attributes, ...pointerListeners },
    setNodeRef,
  };
};

export const useCatalogDraggable = ({
  type,
}: {
  type: string;
}): CatalogDraggable =>
  useCatalogEntryDraggable({
    data: { kind: "catalog-block", type },
    id: catalogDraggableId(type),
  });

/**
 * The Layout section's one entry, dragged the way a block is.
 *
 * There is only ever one of these on screen, so it needs no id of its own
 * beyond a constant: an area carries no type, and what lands is a new empty
 * area rather than anything the registry knows about.
 */
export const useAreaCatalogDraggable = (): CatalogDraggable =>
  useCatalogEntryDraggable({
    data: { kind: "catalog-area" },
    id: AREA_CATALOG_DRAGGABLE_ID,
  });
