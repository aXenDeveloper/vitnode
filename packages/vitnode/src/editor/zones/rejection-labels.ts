import type { EditorDropRejection } from "../dnd/resolve-drop";

export const ZONE_REJECTION_LABELS = {
  "area-full": "area.full",
  "nested-area": "area.nested_rejected",
  "not-allowed": "zone.rejected",
  "not-registered": "zone.not_registered",
  "zone-full": "zone.full",
  "zone-min": "zone.min",
} as const satisfies Record<EditorDropRejection, string>;

export const AREA_REJECTION_LABELS = {
  "area-full": "area.full",
  "nested-area": "area.nested_rejected",
  "not-allowed": "area.rejected",
  "not-registered": "area.not_registered",
  "zone-full": "zone.full",
  "zone-min": "zone.min",
} as const satisfies Record<EditorDropRejection, string>;

export const DND_REJECTION_LABELS = {
  "area-full": "dnd.area_full",
  "nested-area": "dnd.area_rejected",
  "not-allowed": "dnd.rejected",
  "not-registered": "dnd.not_registered",
  "zone-full": "dnd.zone_full",
  "zone-min": "dnd.zone_min",
} as const satisfies Record<EditorDropRejection, string>;
