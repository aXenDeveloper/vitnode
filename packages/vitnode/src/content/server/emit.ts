import type { Context } from "hono";

import type {
  EventEmitOptions,
  EventEmitResult,
  VitNodeEventName,
} from "../../api/models/events";
import type {
  ContentCreatedPayload,
  ContentDeletedPayload,
  ContentEventAction,
  ContentPublishedPayload,
  ContentTranslationCreatedPayload,
  ContentTranslationDeletedPayload,
  ContentTranslationPublishedPayload,
  ContentTranslationRestoredPayload,
  ContentTranslationUnpublishedPayload,
  ContentTranslationUpdatedPayload,
  ContentUnpublishedPayload,
  ContentUpdatedPayload,
} from "../events";
import type { AnyContentTypeDefinition } from "../types";

import { contentEventName } from "../events";

type ContentPayload =
  | ContentCreatedPayload
  | ContentDeletedPayload
  | ContentPublishedPayload
  | ContentTranslationCreatedPayload
  | ContentTranslationDeletedPayload
  | ContentTranslationPublishedPayload
  | ContentTranslationRestoredPayload<AnyContentTypeDefinition>
  | ContentTranslationUnpublishedPayload
  | ContentTranslationUpdatedPayload<AnyContentTypeDefinition>
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
