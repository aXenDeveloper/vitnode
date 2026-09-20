import type {
  AnyBlockInstance,
  BlockAllowedSpec,
  RegisteredBlock,
} from "../../blocks/types";

import { isBlockAllowed } from "../../blocks/registry";
import { blockDataIssues, safeParseBlockData } from "../../blocks/schema";
import { blockDataShapeIssue } from "../../blocks/shape";
import { resolveBlockVariant } from "../../blocks/variant";

export type EditableBlockIssue =
  | { detail: string; kind: "invalid-data" }
  | { kind: "not-allowed" }
  | { kind: "unknown-type" }
  | { kind: "unknown-variant"; variant: string };

export type StoredBlockIssue = Exclude<
  EditableBlockIssue,
  { kind: "not-allowed" }
>;

export type StoredBlockCheck =
  | { entry: RegisteredBlock; kind: "ready"; variant: string | undefined }
  | { issue: StoredBlockIssue; kind: "issue" };

export type StoredDataCheck = "schema" | "shape";

export interface EditableBlockIssueArgs {
  allowedBlocks: BlockAllowedSpec | undefined;
  dataCheck?: StoredDataCheck;
  entry: RegisteredBlock | undefined;
  instance: AnyBlockInstance;
}

const storedDataIssue = (
  entry: RegisteredBlock,
  instance: AnyBlockInstance,
  dataCheck: StoredDataCheck,
): null | string => {
  const shape = blockDataShapeIssue(entry.definition, instance.data);
  if (shape !== null || dataCheck === "shape") return shape;

  const parsed = safeParseBlockData(entry.definition, instance.data);

  return parsed.success ? null : blockDataIssues(parsed.error);
};

export const checkStoredBlock = (
  entry: RegisteredBlock | undefined,
  instance: AnyBlockInstance,
  dataCheck: StoredDataCheck = "shape",
): StoredBlockCheck => {
  if (!entry) return { issue: { kind: "unknown-type" }, kind: "issue" };

  const resolution = resolveBlockVariant(entry.definition, instance.variant);
  if (resolution.kind === "unknown") {
    return {
      issue: { kind: "unknown-variant", variant: resolution.variant },
      kind: "issue",
    };
  }

  const detail = storedDataIssue(entry, instance, dataCheck);

  return detail === null
    ? { entry, kind: "ready", variant: resolution.variant }
    : { issue: { detail, kind: "invalid-data" }, kind: "issue" };
};

export const editableBlockIssue = ({
  allowedBlocks,
  dataCheck = "shape",
  entry,
  instance,
}: EditableBlockIssueArgs): EditableBlockIssue | null => {
  if (!entry) return { kind: "unknown-type" };

  if (
    allowedBlocks !== undefined &&
    !isBlockAllowed(allowedBlocks, instance.type)
  ) {
    return { kind: "not-allowed" };
  }

  const checked = checkStoredBlock(entry, instance, dataCheck);

  return checked.kind === "ready" ? null : checked.issue;
};
