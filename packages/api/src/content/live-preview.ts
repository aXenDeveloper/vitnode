import { z } from "zod";

import type { ContentFileDescriptor } from "./files";
import type { ContentPublicPerson } from "./public-person";

import { zodContentFileDescriptor } from "./files";
import { zodContentPublicPerson } from "./public-person";

/**
 * The `type` of every live-preview `postMessage`. The preview page sends
 * `ready` to its framing or opening editor when it loads; the editor answers
 * with `values` on that and on every form change.
 */
export const CONTENT_LIVE_PREVIEW_MESSAGE = {
  ready: "vitnode:content-live-preview:ready",
  values: "vitnode:content-live-preview:values",
} as const;

/**
 * The descriptors behind the identifiers in `values`, so a preview can render a
 * cover image just uploaded or an author just picked without a lookup of its
 * own. Each list holds every descriptor the editor knows, saved or not.
 */
export interface ContentLivePreviewReferences {
  files: ContentFileDescriptor[];
  people: ContentPublicPerson[];
}

/** One message from the editor: the unsaved form, as the form holds it. */
export interface ContentLivePreviewPayload {
  /** The language the editor is writing in. */
  locale: string;
  references: ContentLivePreviewReferences;
  /**
   * Every field by name, in the form's own shapes: a file or user field holds
   * identifiers (look them up in `references`), a localized field holds
   * `{ languageCode, value }[]`.
   */
  values: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const zodReferences = z.object({
  files: z.array(zodContentFileDescriptor).catch([]),
  people: z.array(zodContentPublicPerson).catch([]),
});

/**
 * Reads a `values` message (`event.data`) sent by the editor's
 * `ContentLivePreview`. Universal and pure.
 *
 * Accepts `{ type: CONTENT_LIVE_PREVIEW_MESSAGE.values, locale: string,
 * values: object, references?: { files, people } }`. Returns `null` for any
 * other type, a missing `locale` or a `values` that is not a plain object.
 * Invalid `references` lists become empty lists instead of rejecting the
 * message.
 *
 * Only the envelope is checked: each entry in `values` stays `unknown`, so
 * validate a field before you render it. It does not authenticate the
 * message either - check `event.origin` and `event.source` first, as
 * `useContentLivePreview` does.
 */
export const parseContentLivePreviewValues = (
  data: unknown,
): ContentLivePreviewPayload | null => {
  if (!isRecord(data) || data.type !== CONTENT_LIVE_PREVIEW_MESSAGE.values) {
    return null;
  }
  if (typeof data.locale !== "string" || !isRecord(data.values)) return null;

  return {
    locale: data.locale,
    references: zodReferences
      .catch({ files: [], people: [] })
      .parse(data.references),
    values: data.values,
  };
};

/**
 * Whether `event.data` is the `ready` message a preview page sends when it
 * loads, telling the editor to send the current values. Universal and pure.
 *
 * Accepts any object whose `type` is `CONTENT_LIVE_PREVIEW_MESSAGE.ready`;
 * other properties are ignored. It does not authenticate the message - check
 * `event.origin` and that `event.source` is the preview frame or popup the
 * editor opened before answering.
 */
export const isContentLivePreviewReady = (data: unknown): boolean =>
  isRecord(data) && data.type === CONTENT_LIVE_PREVIEW_MESSAGE.ready;
