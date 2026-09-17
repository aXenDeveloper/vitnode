import type { ReactElement, ReactNode } from "react";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import type { ContentNode } from "../../blocks/types";
import type { EditorContainerRef } from "../state/types";

import { nodeKindOf } from "../state/reducer";
import { nodeDraggableId } from "./resolve-drop";

export const ContainerSortable = ({
  children,
  container,
  nodes,
}: {
  children: ReactNode;
  container: EditorContainerRef;
  nodes: readonly ContentNode[];
}): ReactElement => (
  <SortableContext
    items={nodes.map(node =>
      nodeDraggableId({
        areaId: container.areaId,
        kind: nodeKindOf(node),
        nodeId: node.id,
        zoneId: container.zoneId,
      }),
    )}
    strategy={verticalListSortingStrategy}
  >
    {children}
  </SortableContext>
);
