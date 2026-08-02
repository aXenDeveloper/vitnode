import type { Context } from "hono";

import type { VitNodeEventName } from "../../api/models/events";
import type {
  ContentCreatedPayload,
  ContentDeletedPayload,
  ContentEventAction,
  ContentUpdatedPayload,
} from "../events";
import type { AnyContentTypeDefinition } from "../types";

import { contentEventName } from "../events";

type ContentPayload =
  | ContentCreatedPayload
  | ContentDeletedPayload
  | ContentUpdatedPayload<AnyContentTypeDefinition>;

/**
 * Emits a content event after a successful write.
 *
 * Generated routes work with `AnyContentTypeDefinition`, so the event name is
 * only a `string` at this point. Plugins get the real literal types from
 * `ContentEventsFor` at their `declare module` site; this is the single place
 * where the runtime name is reconciled with the global event map.
 *
 * Call it only once the database write has returned - never inside a
 * transaction callback.
 */
export const emitContentEvent = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  action: ContentEventAction,
  payload: ContentPayload,
): Promise<void> => {
  const name = contentEventName(definition.id, action) as VitNodeEventName;

  await c.get("events").emit(name, payload);
};
