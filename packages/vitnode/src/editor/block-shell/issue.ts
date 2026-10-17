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

interface CachedCheck {
  check: StoredBlockCheck;
  dataCheck: StoredDataCheck;
  entry: RegisteredBlock;
}

/**
 * Instances are immutable - the editor's reducer replaces an edited one and
 * keeps the rest by identity - so a check is cached per instance. Every block
 * shell, the save guard and the remove guard ask on each render; without this
 * each keystroke would re-run the schema parse for every block on the page.
 */
const checkCache = new WeakMap<AnyBlockInstance, CachedCheck[]>();

const runStoredBlockCheck = (
  entry: RegisteredBlock,
  instance: AnyBlockInstance,
  dataCheck: StoredDataCheck,
): StoredBlockCheck => {
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

export const checkStoredBlock = (
  entry: RegisteredBlock | undefined,
  instance: AnyBlockInstance,
  dataCheck: StoredDataCheck = "shape",
): StoredBlockCheck => {
  if (!entry) return { issue: { kind: "unknown-type" }, kind: "issue" };

  const cached = checkCache.get(instance);
  const hit = cached?.find(
    item => item.entry === entry && item.dataCheck === dataCheck,
  );
  if (hit) return hit.check;

  const check = runStoredBlockCheck(entry, instance, dataCheck);
  const fresh = (cached ?? []).filter(item => item.dataCheck !== dataCheck);
  checkCache.set(instance, [...fresh, { check, dataCheck, entry }]);

  return check;
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
