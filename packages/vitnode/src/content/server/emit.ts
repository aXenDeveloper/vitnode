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
