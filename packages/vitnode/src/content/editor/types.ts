import type { BlockAllowedSpec, ContentNode } from "../../blocks/types";

/** The moderator permission a member needs before the visual editor opens on a page. */
export interface EditablePagePermission {
  /** The permission module, e.g. `"widgets"`. */
  module: string;
  /** The permission inside it, e.g. `"can_edit"`. */
  permission: string;
  /** The plugin that owns the module. Defaults to the page's own plugin. */
  plugin?: string;
}

/** One zone of {@link EditablePageDefinition} as it is declared. */
export interface EditablePageZoneInput {
  /** Block ids the zone accepts, e.g. `["core:text"]`, or `"*"` (default) for every installed block. */
  allowed?: BlockAllowedSpec;
  /** Blocks served until somebody saves the zone. Must satisfy `min`, `max` and `allowed`. */
  default?: readonly ContentNode[];
  /** The most blocks the zone holds. Defaults to 200. */
  max?: number;
  /** The fewest blocks the zone must hold. */
  min?: number;
}

export interface EditablePageZone {
  allowed: BlockAllowedSpec;
  default: readonly ContentNode[];
  max: number | undefined;
  min: number | undefined;
  zoneId: string;
}

export interface EditablePageZoneProps {
  allowedBlocks: BlockAllowedSpec;
  id: string;
}

/** A validated editable page, returned by `defineEditablePage()`. */
export interface EditablePageDefinition<TZoneId extends string = string> {
  id: string;
  permission: EditablePagePermission;
  /**
   * Props for the widget zone that renders `zoneId`. Throws for a zone the
   * page does not declare.
   */
  zone: (zoneId: TZoneId) => EditablePageZoneProps;
  zoneIds: readonly string[];
  zones: Readonly<Record<string, EditablePageZone>>;
}

export type AnyEditablePageDefinition = EditablePageDefinition<never>;

/** What a save sends: the changed zones, and what they held when editing began. */
export interface EditablePageSavePayload {
  /** The zones as they were loaded, so the server can refuse a save over a newer one. */
  expectedZones: Record<string, ContentNode[]>;
  pageId: string;
  zones: Record<string, ContentNode[]>;
}

/** A page's stored layout. Zones nobody has saved are absent and use their `default`. */
export interface EditablePageLayoutPayload {
  pageId: string;
  updatedAt: null | string;
  zones: Record<string, ContentNode[]>;
}

export interface EditablePageAdapterArgs {
  /**
   * The page from `defineEditablePage`. A save that changed a zone it does not
   * declare is refused as a whole (`EditablePageSaveRefused`).
   */
  page: AnyEditablePageDefinition;
  /**
   * Persists the changed zones and resolves with the stored layout. Throw
   * `EditablePageSaveRefused` to show the editor a refusal (with
   * `conflict: true` for a save over a newer layout).
   */
  save: (
    payload: EditablePageSavePayload,
  ) => Promise<EditablePageLayoutPayload>;
}
