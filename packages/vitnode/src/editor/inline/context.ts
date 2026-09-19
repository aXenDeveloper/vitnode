import { createContext, use } from "react";

import type { AnyBlockDefinition, AnyBlockInstance } from "../../blocks/types";
import type { EditorNodeRef } from "../state/types";

export interface EditorInlineBlockValue {
  definition: AnyBlockDefinition | undefined;
  hasInlineFields: boolean;
  instance: AnyBlockInstance;
  nodeRef: EditorNodeRef;
  registerField: () => () => void;
}

export const EditorInlineBlockContext =
  createContext<EditorInlineBlockValue | null>(null);

export const useEditorInlineBlock = (): EditorInlineBlockValue | null =>
  use(EditorInlineBlockContext);
