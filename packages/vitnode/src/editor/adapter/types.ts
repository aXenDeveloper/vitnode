import type { AnyBlockInstance } from "../../blocks/types";

export interface VisualEditorSaveInput {
  changedZoneIds: readonly string[];
  zones: Readonly<Record<string, readonly AnyBlockInstance[]>>;
}

export interface VisualEditorAdapter {
  save: (input: VisualEditorSaveInput) => Promise<void> | void;
}
