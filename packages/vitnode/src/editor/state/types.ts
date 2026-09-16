import type {
  AnyBlockInstance,
  BlockAllowedSpec,
  BlockRegistry,
} from "../../blocks/types";

export interface EditorZoneMount {
  allowedBlocks: BlockAllowedSpec | undefined;
  blocks: readonly AnyBlockInstance[];
  id: string;
  registry: BlockRegistry | undefined;
}

export interface EditorZoneState {
  allowedBlocks: BlockAllowedSpec | undefined;
  blocks: readonly AnyBlockInstance[];
  id: string;
  initial: readonly AnyBlockInstance[];
  registry: BlockRegistry | undefined;
}

export interface VisualEditorState {
  order: readonly string[];
  selectedBlockId: null | string;
  selectedZoneId: null | string;
  zones: Readonly<Record<string, EditorZoneState>>;
}

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
  | { type: "discard" }
  | { type: "mount"; zone: EditorZoneMount }
  | { type: "saved" };
