import { createContext, use } from "react";

import type { BlockAllowedSpec, ContentNode } from "./types";

export interface EditablePageZoneResolution {
  allowedBlocks: BlockAllowedSpec | undefined;
  blocks: readonly ContentNode[];
  max: number;
  min: number | undefined;
}

export interface EditablePageContextValue {
  lookupZone: (zoneId: string) => EditablePageZoneResolution | undefined;
  pageId: string;
  resolveZone: (zoneId: string) => EditablePageZoneResolution;
}

export const EditablePageContext =
  createContext<EditablePageContextValue | null>(null);

export const useEditablePage = (): EditablePageContextValue | null =>
  use(EditablePageContext);
