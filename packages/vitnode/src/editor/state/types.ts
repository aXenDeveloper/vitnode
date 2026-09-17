import type {
  AnyBlockInstance,
  BlockAllowedSpec,
  BlockRegistry,
} from "../../blocks/types";

export interface EditorZoneInvalidEntry {
  index: number;
  value: unknown;
}

export interface EditorZoneMount {
  allowedBlocks: BlockAllowedSpec | undefined;
  blocks: readonly AnyBlockInstance[];
  id: string;
  invalid: readonly EditorZoneInvalidEntry[];
  registry: BlockRegistry | undefined;
}

export interface EditorZoneState {
  allowedBlocks: BlockAllowedSpec | undefined;
  blocks: readonly AnyBlockInstance[];
  id: string;
  initial: readonly AnyBlockInstance[];
  initialInvalid: readonly EditorZoneInvalidEntry[];
  invalid: readonly EditorZoneInvalidEntry[];
  registry: BlockRegistry | undefined;
}

export interface VisualEditorState {
  order: readonly string[];
  selectedBlockId: null | string;
  selectedZoneId: null | string;
  zones: Readonly<Record<string, EditorZoneState>>;
}

export type VisualEditorSnapshot = Readonly<
  Record<string, readonly AnyBlockInstance[]>
>;

export type VisualEditorInvalidSnapshot = Readonly<
  Record<string, readonly EditorZoneInvalidEntry[]>
>;

export type VisualEditorAction =
  | { blockId: null | string; type: "select" }
  | { blockId: string; data: Record<string, unknown>; type: "update" }
  | { blockId: string; toIndex: number; toZoneId: string; type: "move" }
  | { blockId: string; type: "duplicate" }
  | { blockId: string; type: "remove" }
  | {
      index: number;
      instance: AnyBlockInstance;
      type: "insert";
      zoneId: string;
    }
  | { index: number; type: "remove-invalid"; zoneId: string }
  | {
      invalid: VisualEditorInvalidSnapshot;
      snapshot: VisualEditorSnapshot;
      type: "saved";
    }
  | { type: "discard" }
  | { type: "mount"; zone: EditorZoneMount };
