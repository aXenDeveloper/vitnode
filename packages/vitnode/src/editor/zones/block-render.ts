import type { AnyBlockInstance, RegisteredBlock } from "../../blocks/types";

import { blockDataShapeIssue } from "../../blocks/shape";
import { resolveBlockVariant } from "../../blocks/variant";

export type EditableBlockRender =
  | { detail: string; kind: "invalid-data" }
  | { entry: RegisteredBlock; kind: "component"; variant: string | undefined }
  | { kind: "unknown-type" }
  | { kind: "unknown-variant"; variant: string };

export interface EditableBlockRenderArgs {
  entry: RegisteredBlock | undefined;
  instance: AnyBlockInstance;
}

export const editableBlockRender = ({
  entry,
  instance,
}: EditableBlockRenderArgs): EditableBlockRender => {
  if (!entry) return { kind: "unknown-type" };

  const resolution = resolveBlockVariant(entry.definition, instance.variant);
  if (resolution.kind === "unknown") {
    return { kind: "unknown-variant", variant: resolution.variant };
  }

  const detail = blockDataShapeIssue(entry.definition, instance.data);

  return detail === null
    ? { entry, kind: "component", variant: resolution.variant }
    : { detail, kind: "invalid-data" };
};
