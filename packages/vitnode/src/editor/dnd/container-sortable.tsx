import type { ReactElement, ReactNode } from "react";

import {
  rectSortingStrategy,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import type { ContentNode } from "../../blocks/types";
import type { EditorContainerRef } from "../state/types";

import { useStableIds } from "../../lib/dnd/use-stable-ids";
import { nodeKindOf } from "../state/reducer";
import { nodeDraggableId } from "./resolve-drop";

export const ContainerSortable = ({
  children,
  columns = 1,
  container,
  nodes,
}: {
  children: ReactNode;
  columns?: number;
  container: EditorContainerRef;
  nodes: readonly ContentNode[];
}): ReactElement => {
  const items = useStableIds(
    nodes.map(node =>
      nodeDraggableId({
        areaId: container.areaId,
        kind: nodeKindOf(node),
        nodeId: node.id,
        zoneId: container.zoneId,
      }),
    ),
  );

  return (
    <SortableContext
      items={items}
      strategy={columns > 1 ? rectSortingStrategy : verticalListSortingStrategy}
    >
      {children}
    </SortableContext>
  );
};
