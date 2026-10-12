import type { Context } from "hono";

import type { EventEmitFailure } from "../../api/models/events";
import type { PageCacheInvalidationMode } from "../../page-cache/store.server";
import type { ContentEventAction } from "../events";
import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";

import { invalidatePageCacheTags } from "../../page-cache/store.server";
import { contentPublicItemTag, contentPublicListTag } from "../cache";

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
): null | PageCacheInvalidationMode => {
  if (PRIVATE_ACTIONS.has(action)) return null;
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
): Promise<EventEmitFailure | null> => {
  const mode = contentPageInvalidationMode(definition, action, payload);
  if (mode === null) return null;

  const result = await invalidatePageCacheTags(
    [
      ...contentRecordPageCacheTags(definition, recordIdOf(payload)),
      ...contentListPageCacheTags(definition),
    ],
    { mode },
  );
  if (result.status !== "failed") return null;

  const error =
    result.error instanceof Error ? result.error.message : "unknown error";
  const message = `[page-cache] ${definition.id} ${action}: cached pages could not be invalidated (${error}). This server stops serving cached pages until they expire; other servers sharing the cache keep theirs.`;

  try {
    await c.get("log").error(message);
  } catch {
    // oxlint-disable-next-line no-console
    console.error(`[VitNode] ${message}`);
  }

  return {
    error,
    listener: "invalidate",
    module: "page-cache",
    pluginId: "@vitnode/core",
  };
};
