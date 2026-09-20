import type { AnyBlockInstance, RegisteredBlock } from "../../blocks/types";
import type { StoredBlockIssue } from "../block-shell/issue";

import { checkStoredBlock } from "../block-shell/issue";

export type EditableBlockRender =
  | StoredBlockIssue
  | { entry: RegisteredBlock; kind: "component"; variant: string | undefined };

export interface EditableBlockRenderArgs {
  entry: RegisteredBlock | undefined;
  instance: AnyBlockInstance;
}

export const editableBlockRender = ({
  entry,
  instance,
}: EditableBlockRenderArgs): EditableBlockRender => {
  const checked = checkStoredBlock(entry, instance);

  return checked.kind === "ready"
    ? { entry: checked.entry, kind: "component", variant: checked.variant }
    : checked.issue;
};
