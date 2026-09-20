import type { ReactElement, ReactNode } from "react";

import { cn } from "cn";
import { useCallback, useMemo, useState } from "react";

import type {
  EditWidgetsControl,
  EditWidgetsOffer,
} from "./edit-widgets-context";
import type { ContentEditorShellMode } from "./editor-shell";

import {
  EditWidgetsContext,
  sameEditWidgetsOffer,
} from "./edit-widgets-context";
import {
  EDITOR_SHELL_CLASS,
  EDITOR_SHELL_EDITING_CLASS,
  EDITOR_SHELL_STYLE,
} from "./editor-shell";

/**
 * The site shell edit mode lives in.
 *
 * It sits above the header, the page and the footer, which is what lets the
 * **Edit widgets** action live in the user menu on every page and the editing
 * sidebar reserve its width from the whole site rather than from one `<main>`.
 *
 * It is a plain block box at all times, carrying nothing but the transition and
 * two custom properties. That is what makes the room it gives the sidebar
 * *animate*: padding can only transition between two values of an element that
 * already has a box, so a wrapper that appeared - or went back to
 * `display: contents` - on the frame the padding changed would snap instead, in
 * whichever direction it was going.
 */
export const EditWidgetsHost = ({
  children,
}: {
  children: ReactNode;
}): ReactElement => {
  const [offer, setOffer] = useState<EditWidgetsOffer | null>(null);
  const [editingPageId, setEditingPageId] = useState<null | string>(null);
  const [shell, setShell] = useState<ContentEditorShellMode | null>(null);

  const editable = offer?.canEdit === true ? offer.pageId : null;

  if (editingPageId !== null && editingPageId !== editable) {
    setEditingPageId(null);
  }

  const publish = useCallback((next: EditWidgetsOffer) => {
    setOffer(current => (sameEditWidgetsOffer(current, next) ? current : next));
  }, []);

  const release = useCallback((pageId: string) => {
    setOffer(current => (current?.pageId === pageId ? null : current));
  }, []);

  const start = useCallback(
    (pageId?: string) => {
      setEditingPageId(pageId ?? editable);
    },
    [editable],
  );

  const stop = useCallback(() => {
    setEditingPageId(null);
  }, []);

  const value = useMemo<EditWidgetsControl>(
    () => ({
      editing: editable !== null && editingPageId === editable,
      offer,
      publish,
      release,
      setShell,
      shell,
      start,
      stop,
    }),
    [editable, editingPageId, offer, publish, release, shell, start, stop],
  );

  return (
    <EditWidgetsContext value={value}>
      <div
        className={cn(
          EDITOR_SHELL_CLASS,
          shell === "editing" && EDITOR_SHELL_EDITING_CLASS,
        )}
        style={EDITOR_SHELL_STYLE}
      >
        {children}
      </div>
    </EditWidgetsContext>
  );
};
