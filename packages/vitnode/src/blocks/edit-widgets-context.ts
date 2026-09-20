import { createContext, use } from "react";

import type { ContentEditorShellMode } from "./editor-shell";

/**
 * What an editable page currently on screen says about itself.
 *
 * Plain data rather than a callback, so the value an `<EditablePage>` publishes
 * is stable across its renders and republishing it cannot feed back into the
 * render that produced it.
 */
export interface EditWidgetsOffer {
  canEdit: boolean;
  pageId: string;
}

export interface EditWidgetsControl {
  editing: boolean;
  offer: EditWidgetsOffer | null;
  publish: (offer: EditWidgetsOffer) => void;
  release: (pageId: string) => void;
  setShell: (mode: ContentEditorShellMode | null) => void;
  shell: ContentEditorShellMode | null;
  /** Opens the editor. Without a page id, on whichever page is offering one. */
  start: (pageId?: string) => void;
  stop: () => void;
}

export const EditWidgetsContext = createContext<EditWidgetsControl | null>(
  null,
);

export const useEditWidgets = (): EditWidgetsControl | null =>
  use(EditWidgetsContext);

export const sameEditWidgetsOffer = (
  left: EditWidgetsOffer | null,
  right: EditWidgetsOffer | null,
): boolean =>
  left === right ||
  (left !== null &&
    right !== null &&
    left.pageId === right.pageId &&
    left.canEdit === right.canEdit);
