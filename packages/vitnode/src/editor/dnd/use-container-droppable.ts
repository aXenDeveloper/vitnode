import { useDroppable } from "@dnd-kit/core";

import type { EditorContainerRef } from "../state/types";
import type { EditorDropRejection } from "./resolve-drop";

import { useVisualEditor } from "../context";
import { dropCapacity } from "../state/bounds";
import { targetCapabilities } from "../state/capabilities";
import { containerNodes } from "../state/reducer";
import { useEditorDnd } from "./context";
import {
  areaDroppableId,
  decideDrop,
  isCatalogSource,
  zoneDroppableId,
} from "./resolve-drop";

export interface ContainerDroppable {
  active: boolean;
  over: boolean;
  rejection: EditorDropRejection | null;
  setNodeRef: (node: HTMLElement | null) => void;
}

const useContainerDroppable = ({
  container,
  data,
  id,
}: {
  container: EditorContainerRef;
  data: Record<string, unknown>;
  id: string;
}): ContainerDroppable => {
  const { state } = useVisualEditor();
  const { dragging } = useEditorDnd();
  const { isOver, setNodeRef } = useDroppable({ data, id });

  return {
    active: dragging !== null,
    over: isOver,
    rejection:
      dragging === null
        ? null
        : decideDrop({
            capabilities: targetCapabilities(state, container),
            capacity: dropCapacity(state, {
              from: isCatalogSource(dragging)
                ? null
                : dragging.container.zoneId,
              to: container.zoneId,
            }),
            source: dragging,
            target: {
              container,
              edge: null,
              index: null,
              kind: null,
              nodeId: null,
            },
            targetNodeCount: containerNodes(state, container)?.length ?? 0,
          }).rejection,
    setNodeRef,
  };
};

export const useZoneDroppable = ({
  zoneId,
}: {
  zoneId: string;
}): ContainerDroppable =>
  useContainerDroppable({
    container: { areaId: null, zoneId },
    data: { areaId: null, kind: "zone", zoneId },
    id: zoneDroppableId(zoneId),
  });

export const useAreaDroppable = ({
  areaId,
  zoneId,
}: {
  areaId: string;
  zoneId: string;
}): ContainerDroppable =>
  useContainerDroppable({
    container: { areaId, zoneId },
    data: { areaId, kind: "area-container", zoneId },
    id: areaDroppableId({ areaId, zoneId }),
  });
