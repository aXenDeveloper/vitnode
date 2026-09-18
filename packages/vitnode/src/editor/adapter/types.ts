/* eslint-disable @typescript-eslint/no-invalid-void-type */
import type { VisualEditorSnapshot } from "../state/types";

export interface VisualEditorSaveInput {
  changedZoneIds: readonly string[];
  zones: VisualEditorSnapshot;
}

export interface VisualEditorSaveResult {
  revision?: string;
  zones?: VisualEditorSnapshot;
}

export interface VisualEditorSaveRefusal {
  refusal: string;
}

export interface VisualEditorAdapter {
  save: (
    input: VisualEditorSaveInput,
  ) => Promise<VisualEditorSaveResult | void> | VisualEditorSaveResult | void;
}
