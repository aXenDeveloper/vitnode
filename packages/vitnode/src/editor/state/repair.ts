import type { ContentNode } from "../../blocks/types";
import type { EditorZoneState } from "./types";

import { isBlockAreaInstance } from "../../blocks/area";
import { editableBlockIssue } from "../block-shell/issue";
import { zoneRegistry } from "./capabilities";

export const isRepairRemoval = (
  zone: EditorZoneState,
  node: ContentNode,
): boolean => {
  if (isBlockAreaInstance(node)) return false;

  const registry = zoneRegistry(zone);
  if (registry === undefined) return false;

  return (
    editableBlockIssue({
      allowedBlocks: zone.allowedBlocks,
      dataCheck: "schema",
      entry: registry.get(node.type),
      instance: node,
    }) !== null
  );
};
