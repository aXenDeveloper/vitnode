import type { ContentNode } from "../../blocks/types";
import type {
  VisualEditorAdapter,
  VisualEditorSaveResult,
} from "../../editor/adapter/types";
import type { EditablePageAdapterArgs } from "./types";

import { ContentEngineError } from "../errors";

const quoted = (values: readonly string[]): string =>
  values.map(value => JSON.stringify(value)).join(", ");

export class EditablePageSaveRefused extends ContentEngineError {
  constructor(refusal: string, options?: { pageId?: string }) {
    super(refusal, { contentTypeId: options?.pageId });

    this.name = "EditablePageSaveRefused";
    this.refusal = refusal;
  }

  readonly refusal: string;
}

export const createContentEditorAdapter = ({
  page,
  save,
}: EditablePageAdapterArgs): VisualEditorAdapter => ({
  save: async (input): Promise<VisualEditorSaveResult> => {
    const undeclared = input.changedZoneIds.filter(
      zoneId => !Object.hasOwn(page.zones, zoneId),
    );

    if (undeclared.length > 0) {
      throw new EditablePageSaveRefused(
        `The page ${JSON.stringify(page.id)} does not declare ${quoted(undeclared)}, so ${undeclared.length === 1 ? "that zone" : "those zones"} cannot be saved. It declares ${quoted(page.zoneIds)}. Nothing was sent and nothing was lost: declare the zone in \`defineEditablePage\`, or take it off the page.`,
        { pageId: page.id },
      );
    }

    const changed = new Set(input.changedZoneIds);
    const zones: Record<string, ContentNode[]> = Object.fromEntries(
      Object.entries(input.zones)
        .filter(([zoneId]) => changed.has(zoneId))
        .map(([zoneId, nodes]): [string, ContentNode[]] => [
          zoneId,
          [...nodes],
        ]),
    );

    if (Object.keys(zones).length === 0) return {};

    const payload = await save({ pageId: page.id, zones });

    return { zones: payload.zones };
  },
});
