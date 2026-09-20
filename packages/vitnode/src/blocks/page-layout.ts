import type { EditablePageLayoutPayload } from "../content/editor/types";
import type { VisualEditorSaveInput } from "../editor/adapter/types";
import type { ContentNode } from "./types";

export type EditablePageZones = Readonly<
  Record<string, readonly ContentNode[]>
>;

export const layoutZones = (
  layout: EditablePageLayoutPayload | null | undefined,
): EditablePageZones => (layout ? layout.zones : {});

export const layoutKey = (
  layout: EditablePageLayoutPayload | null | undefined,
): string =>
  layout ? `${layout.pageId}@${layout.updatedAt ?? "default"}` : "";

export const adoptedZones = (
  input: VisualEditorSaveInput,
  canonical: EditablePageZones | undefined,
): EditablePageZones => {
  const adopted: Record<string, readonly ContentNode[]> = {};

  for (const zoneId of input.changedZoneIds) {
    if (Object.hasOwn(input.zones, zoneId)) {
      adopted[zoneId] = input.zones[zoneId];
    }
  }

  if (canonical) {
    for (const [zoneId, stored] of Object.entries(canonical)) {
      adopted[zoneId] = stored;
    }
  }

  return adopted;
};
