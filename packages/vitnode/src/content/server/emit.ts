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
  },
): Promise<EventEmitResult> => {
  const name = contentEventName(definition.id, action) as VitNodeEventName;
  const events = c.get("events") as unknown as ContentEventEmitter;
  const result = await events.emit(name, payload, {
    pluginId: options?.pluginId,
  });

  // Every content write announces itself here once its transaction has
  // committed, so this is where cached pages learn the content moved. A failure
  // travels with the event's own, so the scheduled path retries it.
  const pageCacheFailure = await invalidateContentPages(
    c,
    definition,
    action,
    payload as unknown as Record<string, unknown>,
  );

  return pageCacheFailure === null
    ? result
    : { ...result, failures: [...result.failures, pageCacheFailure] };
};
