import type { ContentNode } from "../../blocks/types";
import type {
  VisualEditorAdapter,
  VisualEditorSaveResult,
} from "../../editor/adapter/types";
import type { VisualEditorSnapshot } from "../../editor/state/types";
import type { EditablePageAdapterArgs } from "./types";

import { ContentEngineError } from "../errors";

const quoted = (values: readonly string[]): string =>
  values.map(value => JSON.stringify(value)).join(", ");

export class EditablePageSaveRefused extends ContentEngineError {
  constructor(
    refusal: string,
    options?: { conflict?: boolean; pageId?: string },
  ) {
    super(refusal, { contentTypeId: options?.pageId });

    this.name = "EditablePageSaveRefused";
    this.conflict = options?.conflict === true;
    this.refusal = refusal;
  }

  readonly conflict: boolean;
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

    const changed = input.changedZoneIds.filter(
      zoneId =>
        Object.hasOwn(input.zones, zoneId) &&
        Object.hasOwn(input.expectedZones, zoneId),
    );
    const copied = (
      snapshot: VisualEditorSnapshot,
    ): Record<string, ContentNode[]> =>
      Object.fromEntries(
        changed.map((zoneId): [string, ContentNode[]] => [
          zoneId,
          [...snapshot[zoneId]],
        ]),
      );

    if (changed.length === 0) return {};

    const payload = await save({
      expectedZones: copied(input.expectedZones),
      pageId: page.id,
      zones: copied(input.zones),
    });

    return { zones: payload.zones };
  },
});
