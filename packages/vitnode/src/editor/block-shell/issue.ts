import type {
  AnyBlockInstance,
  BlockAllowedSpec,
  RegisteredBlock,
} from "../../blocks/types";

import { isBlockAllowed } from "../../blocks/registry";
import { blockDataShapeIssue } from "../../blocks/shape";

export type EditableBlockIssue =
  "invalid-data" | "not-allowed" | "unknown-type";

export interface EditableBlockIssueArgs {
  allowedBlocks: BlockAllowedSpec | undefined;
  entry: RegisteredBlock | undefined;
  instance: AnyBlockInstance;
}

export const editableBlockIssue = ({
  allowedBlocks,
  entry,
  instance,
}: EditableBlockIssueArgs): EditableBlockIssue | null => {
  if (!entry) return "unknown-type";

  if (
    allowedBlocks !== undefined &&
    !isBlockAllowed(allowedBlocks, instance.type)
  ) {
    return "not-allowed";
  }

  return blockDataShapeIssue(entry.definition, instance.data) === null
    ? null
    : "invalid-data";
};
