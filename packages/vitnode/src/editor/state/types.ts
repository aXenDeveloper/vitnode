import type {
  AnyBlockInstance,
  BlockAllowedSpec,
  BlockRegistry,
} from "../../blocks/types";

export interface EditorBlockRef {
  blockId: string;
  zoneId: string;
}

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
  droppedZoneIds: readonly string[];
  order: readonly string[];
  selected: EditorBlockRef | null;
  zones: Readonly<Record<string, EditorZoneState>>;
}

export type VisualEditorSnapshot = Readonly<
  Record<string, readonly AnyBlockInstance[]>
>;

export type VisualEditorInvalidSnapshot = Readonly<
  Record<string, readonly EditorZoneInvalidEntry[]>
>;

export type VisualEditorAction =
  | {
      blockId: string;
      fromZoneId: string;
      toIndex: number;
      toZoneId: string;
      type: "move";
    }
  | { data: Record<string, unknown>; ref: EditorBlockRef; type: "update" }
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
  | { ref: EditorBlockRef; type: "duplicate" }
  | { ref: EditorBlockRef; type: "remove" }
  | { ref: EditorBlockRef | null; type: "select" }
  | { type: "discard" }
  | { type: "dismiss-dropped" }
  | { type: "mount"; zone: EditorZoneMount }
  | { type: "unmount"; zoneId: string };
