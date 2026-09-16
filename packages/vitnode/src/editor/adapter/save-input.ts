import type { AnyBlockInstance } from "../../blocks/types";
import type { VisualEditorState } from "../state/types";
import type { VisualEditorSaveInput } from "./types";

import { changedZoneIds } from "../state/reducer";

export const buildSaveInput = (
  state: VisualEditorState,
): VisualEditorSaveInput => ({
  changedZoneIds: changedZoneIds(state),
  zones: Object.fromEntries(
    state.order
      .map(zoneId => [zoneId, state.zones[zoneId]?.blocks] as const)
      .filter(
        (entry): entry is readonly [string, readonly AnyBlockInstance[]] =>
          entry[1] !== undefined,
      ),
  ),
});
