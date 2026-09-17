import type { AnyBlockInstance, RegisteredBlock } from "../../blocks/types";

import { blockDataShapeIssue } from "../../blocks/shape";

export type EditableBlockRender =
  | { detail: string; kind: "invalid-data" }
  | { entry: RegisteredBlock; kind: "component" }
  | { kind: "unknown-type" };

export interface EditableBlockRenderArgs {
  entry: RegisteredBlock | undefined;
  instance: AnyBlockInstance;
}

export const editableBlockRender = ({
  entry,
  instance,
}: EditableBlockRenderArgs): EditableBlockRender => {
  if (!entry) return { kind: "unknown-type" };

  const detail = blockDataShapeIssue(entry.definition, instance.data);

  return detail === null
    ? { entry, kind: "component" }
    : { detail, kind: "invalid-data" };
};
