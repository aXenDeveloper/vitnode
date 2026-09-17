import type { ReactElement, ReactNode } from "react";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { blockDraggableId } from "./resolve-drop";

export const ZoneSortable = ({
  blockIds,
  children,
  zoneId,
}: {
  blockIds: readonly string[];
  children: ReactNode;
  zoneId: string;
}): ReactElement => (
  <SortableContext
    items={blockIds.map(blockId => blockDraggableId({ blockId, zoneId }))}
    strategy={verticalListSortingStrategy}
  >
    {children}
  </SortableContext>
);
