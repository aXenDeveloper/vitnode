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

import { contentEventName } from "../events";
import { invalidateContentPages } from "./page-cache";

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
 * Emits `content.{definition.id}.{action}` on the request's event bus and then
 * invalidates the cached pages that show the content type. Call it after the
 * write's transaction has committed. The generated routes already emit every
 * built-in event; use this from custom write paths. Server-only.
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

  return pageCacheFailure === null
    ? result
    : { ...result, failures: [...result.failures, pageCacheFailure] };
};
