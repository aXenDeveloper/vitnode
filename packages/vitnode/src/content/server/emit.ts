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

type ContentPayload =
  | ContentCreatedPayload
  | ContentDeletedPayload
  | ContentDuplicableCreatedPayload<ContentId>
  | ContentDuplicatedPayload<ContentId>
  | ContentHiddenPayload<ContentId>
  | ContentPublishedPayload
  | ContentTranslationCreatedPayload
  | ContentTranslationDeletedPayload
  | ContentTranslationPublishedPayload
  | ContentTranslationRestoredPayload<AnyContentTypeDefinition>
  | ContentTranslationUnpublishedPayload
  | ContentTranslationUpdatedPayload<AnyContentTypeDefinition>
  | ContentUnhiddenPayload<ContentId>
  | ContentUnpublishedPayload
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

  return await events.emit(name, payload, { pluginId: options?.pluginId });
};
