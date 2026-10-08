import React from "react";

import type { RichTextDocument } from "@/content/rich-text/document";

import { useContentLive } from "./context";

/** One co-edited rich text editor, as code outside it may drive it. */
export interface ContentRichTextEditorHandle {
  /**
   * Replaces the whole document in one transaction. It goes through the
   * shared document, so every open editor of the field gets it.
   */
  replace: (document: RichTextDocument) => void;
}

/**
 * The co-edited rich text editors of one form, by field and language, so a
 * layout (AI tools, a translation panel) can write through them rather than
 * around them.
 */
export interface ContentRichTextRegistry {
  get: (
    field: string,
    locale: null | string,
  ) => ContentRichTextEditorHandle | null;
  register: (
    field: string,
    locale: null | string,
    handle: ContentRichTextEditorHandle,
  ) => () => void;
  /**
   * Replaces a field's document now, or as soon as its editor opens - the
   * language may not be on screen yet.
   */
  replace: (
    field: string,
    locale: null | string,
    document: RichTextDocument,
  ) => void;
  subscribe: (listener: () => void) => () => void;
}

const keyOf = (field: string, locale: null | string): string =>
  `${field}\u0000${locale ?? ""}`;

export const createContentRichTextRegistry = (): ContentRichTextRegistry => {
  const editors = new Map<string, ContentRichTextEditorHandle>();
  const pending = new Map<string, RichTextDocument>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    get: (field, locale) => editors.get(keyOf(field, locale)) ?? null,
    register: (field, locale, handle) => {
      const key = keyOf(field, locale);
      editors.set(key, handle);
      const waiting = pending.get(key);
      if (waiting) {
        pending.delete(key);
        handle.replace(waiting);
      }
      notify();

      return () => {
        if (editors.get(key) !== handle) return;
        editors.delete(key);
        notify();
      };
    },
    replace: (field, locale, document) => {
      const key = keyOf(field, locale);
      const editor = editors.get(key);
      if (editor) {
        pending.delete(key);
        editor.replace(document);

        return;
      }
      pending.set(key, document);
    },
    subscribe: listener => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};

const subscribeNever = () => () => {};
const getNull = () => null;

/**
 * The co-edited editor of one rich text field in one language, while it is
 * open; `null` otherwise, and always outside a live form.
 */
export const useContentRichTextEditor = (
  field: string,
  locale: null | string,
): ContentRichTextEditorHandle | null => {
  const live = useContentLive();
  const registry = live?.richText;

  return React.useSyncExternalStore(
    registry?.subscribe ?? subscribeNever,
    registry ? () => registry.get(field, locale) : getNull,
    getNull,
  );
};

/**
 * Writes a whole rich text document through the co-edited editor of that
 * field and language, so it reaches everyone in it. `null` when the form is
 * not co-edited - the caller then sets the form value as usual.
 */
export const useContentRichTextReplace = ():
  | ((field: string, locale: null | string, document: RichTextDocument) => void)
  | null => {
  const live = useContentLive();

  return live?.coEditing ? live.richText.replace : null;
};
