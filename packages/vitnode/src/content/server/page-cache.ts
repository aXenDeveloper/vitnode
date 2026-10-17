import type { Context } from "hono";

import type { EventEmitFailure } from "../../api/models/events";
import type { PageCacheInvalidationMode } from "../../page-cache/store.server";
import type { ContentEventAction } from "../events";
import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";

import { invalidatePageCacheTags } from "../../page-cache/store.server";
import { contentPublicItemTag, contentPublicListTag } from "../cache";
import { bumpContentPublicGeneration } from "./public-cache";
import { isContentBaseRowPublic } from "./visibility";

/**
 * Whether the record was publicly readable before and after one write.
 *
 * Travels beside the event rather than in its payload, so listeners see the same
 * minimal payloads as ever. Absent means "unknown", which is treated as public:
 * a skipped invalidation serves a stale page, a needless one costs a render.
 */
export interface ContentPublicState {
  isPublic: boolean;
  wasPublic: boolean;
}

/**
 * {@link ContentPublicState} for a write that cannot move publication itself - a
 * create, an edit, a delete - read off the rows on either side of it (`null` for
 * the side where the record does not exist).
 *
 * `undefined` without `publication` - such a type's fields may well be called
 * `status`, and the predicate must not read a user's column as a publish flag -
 * and for a row that does not carry its publication columns, which would
 * otherwise read as a draft.
 */
export const contentPublicStateOf = (
  definition: AnyContentTypeDefinition,
  before: null | object,
  after: null | object,
): ContentPublicState | undefined => {
  if (!definition.publication.enabled) return undefined;
  if (!carriesPublication(before) || !carriesPublication(after)) {
    return undefined;
  }

  return {
    isPublic:
      after !== null &&
      isContentBaseRowPublic(after as Record<string, unknown>),
    wasPublic:
      before !== null &&
      isContentBaseRowPublic(before as Record<string, unknown>),
  };
};

const carriesPublication = (row: null | object): boolean =>
  row === null || ("status" in row && "publishedAt" in row);

/**
 * What a public read of one record depends on, for the HTML cache.
 *
 * One tag per record rather than per language: a page lists its translations
 * in its `hreflang` links and may be served by another language's fallback, so
 * a change to any translation can change it. A record whose projection does
 * not expose its id can only be tied to its content type as a whole.
 */
export const contentRecordPageCacheTags = (
  definition: AnyContentTypeDefinition,
  id: ContentId | null | undefined,
): string[] =>
  id === null || id === undefined
    ? [contentPublicListTag(definition.id)]
    : [contentPublicItemTag(definition.id, id)];

/** What a public list of a content type depends on: every record of it. */
export const contentListPageCacheTags = (
  definition: AnyContentTypeDefinition,
): string[] => [contentPublicListTag(definition.id)];

/** Changes after which a page must not be served again, even once. */
const HARD_ACTIONS: ReadonlySet<ContentEventAction> = new Set([
  "deleted",
  "delivery_redirect_created",
  "delivery_slug_changed",
  "hidden",
  "translation_deleted",
  "translation_unpublished",
  "unpublished",
]);

/** Changes that touch no public page. */
const PRIVATE_ACTIONS: ReadonlySet<ContentEventAction> = new Set([
  "schedule_cancelled",
  "scheduled",
]);

const slugChanged = (
  definition: AnyContentTypeDefinition,
  payload: Record<string, unknown>,
): boolean => {
  if (!definition.publicApi.enabled) return false;

  const { changedFields } = payload;

  return (
    Array.isArray(changedFields) &&
    changedFields.some(
      field =>
        typeof field === "string" &&
        (field === definition.publicApi.slugField ||
          field.endsWith(`.${definition.publicApi.slugField}`)),
    )
  );
};

export const contentPageInvalidationMode = (
  definition: AnyContentTypeDefinition,
  action: ContentEventAction,
  payload: Record<string, unknown>,
  publicState?: ContentPublicState,
): null | PageCacheInvalidationMode => {
  if (PRIVATE_ACTIONS.has(action)) return null;
  // The same rule as `contentInvalidationTags`: a record that was never public
  // and still is not - a draft being autosaved - is on no cached page.
  if (publicState && !publicState.wasPublic && !publicState.isPublic) {
    return null;
  }
  if (HARD_ACTIONS.has(action) || slugChanged(definition, payload)) {
    return "hard";
  }

  return "soft";
};

const recordIdOf = (payload: Record<string, unknown>): ContentId | null => {
  const { contentId } = payload;

  return typeof contentId === "number" || typeof contentId === "string"
    ? contentId
    : null;
};

/**
 * Invalidates the cached pages one committed content change affects: every
 * page that read the record, and every page that listed its content type.
 *
 * Runs from `emitContentEvent`, which every content write calls once its
 * transaction has committed - interactive, scheduled, translated, hidden or
 * moved alike - so no write path can forget it.
 *
 * Answers with a failure in the event's own shape, so the scheduled path
 * retries it like any other effect that did not land.
 */
export const invalidateContentPages = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  action: ContentEventAction,
  payload: Record<string, unknown>,
  publicState?: ContentPublicState,
): Promise<EventEmitFailure | null> => {
  const mode = contentPageInvalidationMode(
    definition,
    action,
    payload,
    publicState,
  );
  if (mode === null) return null;

  // The API's own cached public reads go with the pages, on the same rule. This
  // runs from `emitContentEvent`, after the write committed - a bump before the
  // commit would let a reader store the old row under the new generation.
  const [result, generation] = await Promise.all([
    invalidatePageCacheTags(
      [
        ...contentRecordPageCacheTags(definition, recordIdOf(payload)),
        ...contentListPageCacheTags(definition),
      ],
      { mode },
    ),
    bumpContentPublicGeneration(c, definition.id).then(
      () => null,
      (error: unknown) => error,
    ),
  ]);

  if (generation !== null) {
    const error =
      generation instanceof Error ? generation.message : "unknown error";

    await logFailure(
      c,
      `[content-public-cache] ${definition.id} ${action}: cached public reads could not be expired (${error}). They are served until they expire.`,
    );

    if (result.status !== "failed") {
      return {
        error,
        listener: "invalidate",
        module: "content-public-cache",
        pluginId: "@vitnode/core",
      };
    }
  }

  if (result.status !== "failed") return null;

  const error =
    result.error instanceof Error ? result.error.message : "unknown error";

  await logFailure(
    c,
    `[page-cache] ${definition.id} ${action}: cached pages could not be invalidated (${error}). This server stops serving cached pages until they expire; other servers sharing the cache keep theirs.`,
  );

  return {
    error,
    listener: "invalidate",
    module: "page-cache",
    pluginId: "@vitnode/core",
  };
};

const logFailure = async (c: Context, message: string): Promise<void> => {
  try {
    await c.get("log").error(message);
  } catch {
    // oxlint-disable-next-line no-console
    console.error(`[VitNode] ${message}`);
  }
};
