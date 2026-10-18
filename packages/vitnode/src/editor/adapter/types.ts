/* oxlint-disable typescript/no-invalid-void-type */
import type { VisualEditorSnapshot } from "../state/types";

/** What the Visual Editor hands its adapter on **Save**. */
export interface VisualEditorSaveInput {
  /** Zones that differ from what loaded - write only these. */
  changedZoneIds: readonly string[];
  /**
   * For each changed zone, the baseline it started from. Compare it with what
   * is stored to refuse a save that would overwrite someone else's.
   */
  expectedZones: VisualEditorSnapshot;
  /** Every mounted zone keyed by id, emptied ones included. */
  zones: VisualEditorSnapshot;
}

export interface VisualEditorSaveResult {
  revision?: string;
  /** The zones as stored; the editor rebases onto them instead of what it sent. */
  zones?: VisualEditorSnapshot;
}

/**
 * Throw an object of this shape from `save` to show `refusal` to the editor
 * instead of a generic error. With `conflict: true` the editor shows its own
 * someone-saved-first message instead of `refusal`. The editor keeps the
 * unsaved changes either way.
 */
export interface VisualEditorSaveRefusal {
  conflict?: boolean;
  refusal: string;
}

/**
 * Persists Visual Editor changes - the editor itself never fetches. Resolve to
 * mark the editor clean; throw or reject to keep the changes and show an
 * error. Editable pages get one from `createContentEditorAdapter`.
 */
export interface VisualEditorAdapter {
  save: (
    input: VisualEditorSaveInput,
  ) => Promise<VisualEditorSaveResult | void> | VisualEditorSaveResult | void;
}
