import { useDroppable } from "@dnd-kit/core";

import { BLOCK_WILDCARD } from "../../blocks/const";
import { isBlockAllowed } from "../../blocks/registry";
import { useVisualEditor } from "../context";
import { useEditorDnd } from "./context";
import { zoneDroppableId } from "./resolve-drop";

export interface ZoneDroppable {
  active: boolean;
  over: boolean;
  rejected: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
}

export const useZoneDroppable = ({
  zoneId,
}: {
  zoneId: string;
}): ZoneDroppable => {
  const { state } = useVisualEditor();
  const { draggingBlockId, draggingType } = useEditorDnd();
  const { isOver, setNodeRef } = useDroppable({
    data: { zoneId },
    id: zoneDroppableId(zoneId),
  });

  const active = draggingBlockId !== null;
  const rejected =
    active &&
    !isBlockAllowed(
      state.zones[zoneId]?.allowedBlocks ?? BLOCK_WILDCARD,
      draggingType ?? "",
    );

  return { active, over: isOver, rejected, setNodeRef };
};
