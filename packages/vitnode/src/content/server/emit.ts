import type { Context } from "hono";

import type {
  EventEmitOptions,
  EventEmitResult,
  VitNodeEventName,
} from "../../api/models/events";
import type {
  ContentCreatedPayload,
  ContentDeletedPayload,
  ContentDuplicableCreatedPayload,
  ContentDuplicatedPayload,
  ContentEventAction,
  ContentHiddenPayload,
  ContentPublishedPayload,
  ContentTranslationCreatedPayload,
  ContentTranslationDeletedPayload,
  ContentTranslationPublishedPayload,
  ContentTranslationRestoredPayload,
  ContentTranslationUnpublishedPayload,
  ContentTranslationUpdatedPayload,
  ContentUnhiddenPayload,
  ContentUnpublishedPayload,
  ContentUpdatedPayload,
} from "../events";
import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentPublicState } from "./page-cache";

import { followContentSubmissionContainer } from "../approvals/server/follow-container";
import { contentContainerFieldOf } from "../containers/association";
import { contentEventName } from "../events";
import { invalidateContentPages } from "./page-cache";
import { publishContentRefresh } from "./refresh/publish";

type ContentPayload =
  | ContentCreatedPayload<ContentId>
  | ContentDeletedPayload<ContentId>
  | ContentDuplicableCreatedPayload<ContentId>
  | ContentDuplicatedPayload<ContentId>
  | ContentHiddenPayload<ContentId>
  | ContentPublishedPayload<ContentId>
  | ContentTranslationCreatedPayload<ContentId>
  | ContentTranslationDeletedPayload<ContentId>
  | ContentTranslationPublishedPayload<ContentId>
  | ContentTranslationRestoredPayload<AnyContentTypeDefinition>
  | ContentTranslationUnpublishedPayload<ContentId>
  | ContentTranslationUpdatedPayload<AnyContentTypeDefinition>
  | ContentUnhiddenPayload<ContentId>
  | ContentUnpublishedPayload<ContentId>
  | ContentUpdatedPayload<AnyContentTypeDefinition>;

interface ContentEventEmitter {
  emit: (
    name: VitNodeEventName,
    payload: ContentPayload,
    options?: EventEmitOptions,
  ) => Promise<EventEmitResult>;
}

/**
 * Emits `content.{definition.id}.{action}` on the request's event bus,
 * invalidates the cached pages and public reads that show the content type,
 * and only then sends the live refresh signals (`publishContentRefresh`) to
 * open AdminCP lists and threads - so a client that reacts reads the new
 * state. Call it after the write's transaction has committed, never inside
 * it: a rolled-back write must not be announced. The generated routes already
 * emit every built-in event; use this from custom write paths. A plain
 * `model.service(c)` or `model.editorialService(c)` write emits nothing on
 * its own. Server-only.
 *
 * @returns The event bus result, with a page-cache invalidation failure, if
 * any, appended to `failures` rather than thrown.
 */
export const emitContentEvent = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  action: ContentEventAction,
  payload: ContentPayload,
  options?: {
    pluginId?: string;
    /**
     * Whether the record was public before and after the write. Pass it whenever
     * it is known: without it every write - a draft's autosave included - expires
     * the content type's cached lists.
     */
    publicState?: ContentPublicState;
    /**
     * The record after the write, or as it was just before a delete. Live
     * refresh routes a threaded record to its thread with it; a deleted one
     * cannot be read back, so pass it on every delete of a threaded type.
     */
    row?: null | Record<string, unknown>;
  },
): Promise<EventEmitResult> => {
  const name = contentEventName(definition.id, action) as VitNodeEventName;
  const events = c.get("events") as unknown as ContentEventEmitter;
  // Every content write announces itself here once its transaction has
  // committed, so this is where cached pages learn the content moved. Neither
  // waits for the other: a listener does not read the page cache, and the cache
  // does not care who listened. A failure travels with the event's own, so the
  // scheduled path retries it.
  const [result, pageCacheFailure] = await Promise.all([
    events.emit(name, payload, {
      pluginId: options?.pluginId,
    }),
    invalidateContentPages(
      c,
      definition,
      action,
      payload,
      options?.publicState,
    ),
  ]);

  // A record that moved to another container takes its pending approvals - and
  // its replies' - to the new container's moderators.
  const moved = contentContainerFieldOf(definition)?.name;
  if (
    action === "updated" &&
    moved !== undefined &&
    "changedFields" in payload &&
    Array.isArray(payload.changedFields) &&
    (payload.changedFields as string[]).includes(moved)
  ) {
    await followContentSubmissionContainer(
      c,
      definition,
      payload.contentId,
    ).catch(async (error: unknown) => {
      await c
        .get("log")
        ?.error(
          `[content-approvals] ${definition.id}: pending submissions could not follow the record to its new container (${error instanceof Error ? error.message : String(error)}).`,
        );
    });
  }

  // After the caches above, so whoever reads again on this signal misses them.
  await publishContentRefresh(c, {
    action,
    contentId: payload.contentId,
    definition,
    publicState: options?.publicState,
    row: options?.row,
  });

  return pageCacheFailure === null
    ? result
    : { ...result, failures: [...result.failures, pageCacheFailure] };
};
