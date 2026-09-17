import type {
  AnyBlockInstance,
  BlockAllowedSpec,
  RegisteredBlock,
} from "../../blocks/types";

import { isBlockAllowed } from "../../blocks/registry";
import { blockDataShapeIssue } from "../../blocks/shape";
import { resolveBlockVariant } from "../../blocks/variant";

export type EditableBlockIssue =
  "invalid-data" | "not-allowed" | "unknown-type" | "unknown-variant";

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

  if (
    resolveBlockVariant(entry.definition, instance.variant).kind === "unknown"
  ) {
    return "unknown-variant";
  }

  return blockDataShapeIssue(entry.definition, instance.data) === null
    ? null
    : "invalid-data";
};
