import type { AutoTranslateResponse } from "@vitnode/api/content/auto-translate";

import {
  autoTranslateFingerprint,
  autoTranslateSource,
  classifyTranslatableText,
} from "@vitnode/api/content/auto-translate";
import React from "react";

import type { AutoTranslateItemRequest } from "./query";

import { useAutoTranslateContext } from "./scope";
import { autoTranslateItemKey } from "./store";

const subscribeToNothing = () => () => undefined;
const zero = () => 0;

/** One record's fields as the page should render them, and what the reader can do. */
export interface AutoTranslation<TFields extends Record<string, unknown>> {
  /** Whether translations are automatic for this reader (not a manual click). */
  automatic: boolean;
  /** A saved translation exists but the reader chose the original. */
  canShowTranslation: boolean;
  /** A Translate action makes sense: the site allows it and the text qualifies. */
  canTranslate: boolean;
  isPending: boolean;
  /** At least one field shows a translation. */
  isTranslated: boolean;
  showOriginal: () => void;
  showTranslation: () => void;
  /** Language of the original, when known. */
  sourceLocale: null | string;
  translate: () => Promise<AutoTranslateResponse | null>;
  /** Each field: the translation when one is shown, otherwise the original. */
  values: TFields;
}

const HARD_STOPS = new Set([
  "acknowledgment",
  "locale",
  "no_text",
  "not_found",
  "unsupported_language",
]);

/**
 * Shows a record's fields in the reader's language inside an
 * `AutoTranslateScope`. Fingerprints are computed from the values the page
 * renders, so a translation is only shown for the exact text on screen; after
 * an edit or a live refresh the original returns until the new version is
 * translated. Outside a scope it returns the values unchanged.
 *
 * @example
 * ```tsx
 * import { useAutoTranslation } from "@vitnode/core/tanstack/auto-translate";
 *
 * const { elementRef, ...translation } = useAutoTranslation({
 *   contentTypeId: "forum.topic",
 *   id: topic.id,
 *   fields: { body: topic.body },
 * });
 *
 * <article ref={elementRef}>
 *   <RichTextContent content={translation.values.body} />
 * </article>;
 * ```
 */
export const useAutoTranslation = <TFields extends Record<string, unknown>>({
  contentTypeId,
  fields,
  id,
  recordLocale = null,
}: {
  contentTypeId: string;
  /** Field name to the rich-text value the page renders, e.g. `{ body }`. */
  fields: TFields;
  id: number | string;
  /**
   * On a localized content type, the record's public `locale`: the language
   * it was served in. An editorial translation in the reader's language is
   * never machine-translated; the default language served in its place is.
   */
  recordLocale?: null | string;
}): AutoTranslation<TFields> & {
  /** Attach as `ref` to the element that holds the record, so it is translated once on screen. */
  elementRef: (element: Element | null) => void;
} => {
  const context = useAutoTranslateContext();
  const cache = React.useRef(
    new Map<
      string,
      { fingerprint: string; recordLocale: null | string; value: unknown }
    >(),
  );
  const fingerprints = Object.entries(fields).map(([name, value]) => {
    const cached = cache.current.get(name);
    if (
      cached &&
      cached.value === value &&
      cached.recordLocale === recordLocale
    ) {
      return { fingerprint: cached.fingerprint, name };
    }
    const fingerprint = autoTranslateFingerprint({
      field: name,
      sourceLocale: recordLocale,
      value,
    });
    cache.current.set(name, { fingerprint, recordLocale, value });

    return { fingerprint, name };
  });
  const signature = fingerprints
    .map(field => `${field.name}:${field.fingerprint}`)
    .join("|");
  const target = React.useMemo<AutoTranslateItemRequest>(
    () => ({
      contentTypeId,
      fields: signature.split("|").map(entry => {
        const at = entry.lastIndexOf(":");

        return { fingerprint: entry.slice(at + 1), name: entry.slice(0, at) };
      }),
      id,
    }),
    [contentTypeId, id, signature],
  );
  const item = autoTranslateItemKey(contentTypeId, id);

  React.useSyncExternalStore(
    context?.store.subscribe ?? subscribeToNothing,
    context?.store.getVersion ?? zero,
    context?.store.getVersion ?? zero,
  );

  React.useEffect(() => context?.register(target), [context, target]);

  const [element, setElement] = React.useState<Element | null>(null);
  React.useEffect(
    () => (element && context ? context.observe(element, item) : undefined),
    [context, element, item],
  );

  const translatable = React.useMemo(
    () =>
      Object.values(fields).some(
        value =>
          classifyTranslatableText(autoTranslateSource(value).plain).kind !==
          "hard_skip",
      ),
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- recomputed when the text changes
    [signature],
  );

  if (!context?.settings.enabled) {
    return {
      automatic: false,
      canShowTranslation: false,
      canTranslate: false,
      isPending: false,
      isTranslated: false,
      elementRef: setElement,
      showOriginal: () => undefined,
      showTranslation: () => undefined,
      sourceLocale: null,
      translate: async () => await Promise.resolve(null),
      values: fields,
    };
  }

  const { auto, locale, store } = context;
  const manual = store.isManual(locale, item);
  const original = store.isShowingOriginal(item);
  const results = target.fields.map(field => ({
    name: field.name,
    result: store.get(locale, item, field.name, field.fingerprint),
  }));
  const active = (auto || manual) && !original;
  const values: Record<string, unknown> = { ...fields };
  let sourceLocale: null | string = null;
  let isTranslated = false;
  for (const { name, result } of results) {
    if (result?.state === "ready" && result.value !== undefined) {
      sourceLocale ??= result.sourceLocale ?? null;
      if (active) {
        values[name] = result.value;
        isTranslated = true;
      }
    } else if (result?.state === "original" || result?.state === "skipped") {
      sourceLocale ??= result.sourceLocale ?? null;
    }
  }
  const hasReady = results.some(({ result }) => result?.state === "ready");
  const isPending =
    manual && results.some(({ result }) => result?.state === "pending");
  const blocked = results.every(
    ({ result }) =>
      result?.state === "original" ||
      (result?.reason !== undefined && HARD_STOPS.has(result.reason)),
  );
  const softSkipped = results.some(
    ({ result }) =>
      result?.reason === "single_word" ||
      result?.reason === "uncertain_language",
  );

  return {
    automatic: auto && !manual,
    canShowTranslation: hasReady && !isTranslated,
    canTranslate:
      translatable &&
      !isTranslated &&
      !hasReady &&
      !isPending &&
      !blocked &&
      (!auto || softSkipped || context.settings.canGenerate),
    isPending,
    isTranslated,
    elementRef: setElement,
    showOriginal: () => {
      store.setShowingOriginal(item, true);
    },
    showTranslation: () => {
      if (!auto) store.setManual(locale, item);
      store.setShowingOriginal(item, false);
    },
    sourceLocale,
    translate: async () => await context.translate(target),
    values: values as TFields,
  };
};
