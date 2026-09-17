import type {
  AnyBlockInstance,
  BlockAllowedSpec,
  BlockAreaInstance,
  BlockAreaLayout,
  BlockRegistry,
  ContentNode,
} from "../../blocks/types";

export type EditorNodeKind = "area" | "block";

/**
 * Zone-aware, container-aware identity. Two zones may hold instances with the
 * same id, and so may two areas, so nothing in the editor is ever addressed by
 * a bare instance id.
 */
export interface EditorNodeRef {
  /** The area holding this node, or `null` when it sits at the zone root. */
  areaId: null | string;
  kind: EditorNodeKind;
  nodeId: string;
  zoneId: string;
}

/** A list a node can live in: a zone's root, or one area inside it. */
export interface EditorContainerRef {
  areaId: null | string;
  zoneId: string;
}

export interface EditorZoneInvalidEntry {
  index: number;
  value: unknown;
}

export interface EditorZoneMount {
  allowedBlocks: BlockAllowedSpec | undefined;
  id: string;
  invalid: readonly EditorZoneInvalidEntry[];
  nodes: readonly ContentNode[];
  registry: BlockRegistry | undefined;
}

export interface EditorZoneState {
  allowedBlocks: BlockAllowedSpec | undefined;
  id: string;
  initial: readonly ContentNode[];
  initialInvalid: readonly EditorZoneInvalidEntry[];
  invalid: readonly EditorZoneInvalidEntry[];
  nodes: readonly ContentNode[];
  registry: BlockRegistry | undefined;
}

export interface VisualEditorState {
  droppedZoneIds: readonly string[];
  order: readonly string[];
  selected: EditorNodeRef | null;
  zones: Readonly<Record<string, EditorZoneState>>;
}

export type VisualEditorSnapshot = Readonly<
  Record<string, readonly ContentNode[]>
>;

export type VisualEditorInvalidSnapshot = Readonly<
  Record<string, readonly EditorZoneInvalidEntry[]>
>;

export type VisualEditorAction =
  | {
      area: BlockAreaInstance;
      index: number;
      type: "insert-area";
      zoneId: string;
    }
  | {
      canonical: undefined | VisualEditorSnapshot;
      invalid: VisualEditorInvalidSnapshot;
      snapshot: VisualEditorSnapshot;
      type: "saved";
    }
  | {
      container: EditorContainerRef;
      index: number;
      instance: AnyBlockInstance;
      type: "insert";
    }
  | { data: Record<string, unknown>; ref: EditorNodeRef; type: "update" }
  | {
      from: EditorContainerRef;
      nodeId: string;
      to: EditorContainerRef;
      toIndex: number;
      type: "move";
    }
  | { index: number; type: "remove-invalid"; zoneId: string }
  | { layout: BlockAreaLayout; ref: EditorNodeRef; type: "update-area-layout" }
  | { ref: EditorNodeRef; type: "duplicate" }
  | { ref: EditorNodeRef; type: "remove" }
  | { ref: EditorNodeRef; type: "unwrap-area" }
  | { ref: EditorNodeRef | null; type: "select" }
  | { ref: EditorNodeRef; type: "set-variant"; variant: string | undefined }
  | { type: "discard" }
  | { type: "dismiss-dropped" }
  | { type: "mount"; zone: EditorZoneMount }
  | { type: "unmount"; zoneId: string };
