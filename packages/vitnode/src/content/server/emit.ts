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
  ContentUnpublishedPayload,
  ContentUpdatedPayload,
} from "../events";
import type { AnyContentTypeDefinition } from "../types";

import { contentEventName } from "../events";

type ContentPayload =
  | ContentCreatedPayload
  | ContentDeletedPayload
  | ContentPublishedPayload
  | ContentUnpublishedPayload
  | ContentUpdatedPayload<AnyContentTypeDefinition>;

/**
 * `EventsModel.emit` as this module needs to see it.
 *
 * Narrowing the model rather than casting the payload is deliberate: the shape
 * of `VitNodeEvents` here depends on whether a `declare module` block happens to
 * be in the current TypeScript program, and core is compiled both ways - with
 * the type tests (lint, `test:types`) and without them (`build:plugins`). A
 * payload cast is "unnecessary" in one program and required in the other, so the
 * autofixer and the build take turns breaking each other. This does not move.
 */
interface ContentEventEmitter {
  emit: (
    name: VitNodeEventName,
    payload: ContentPayload,
    options?: EventEmitOptions,
  ) => Promise<EventEmitResult>;
}

/**
 * Emits a content event after a successful write.
 *
 * This is the single place where a runtime event name is reconciled with the
 * global event map, and it has to be: `VitNodeEvents` only gains
 * `content.<id>.created` and friends from the *plugin's* `declare module` block,
 * so those keys do not exist while core compiles itself - and a generated route
 * only ever holds an `AnyContentTypeDefinition`, whose `id` is a plain `string`.
 * `ContentEventsFor` is what makes the name/payload pairing sound at the
 * plugin's augmentation site; see `events.test-d.ts`.
 *
 * Call it only once the database write has returned - never inside a
 * transaction callback.
 *
 * The result is **returned, not swallowed**. `EventsModel.emit` never throws, so
 * a listener that fell over is reported rather than raised - and a caller that
 * only awaits this call has silently accepted whatever happened. Interactive
 * routes are right to: the mutation committed and the person is owed a 200
 * either way. The scheduled-effects task is not, and it reads `failures`.
 */
export const emitContentEvent = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  action: ContentEventAction,
  payload: ContentPayload,
  options?: {
    /**
     * The plugin that owns the content type - which is not always the plugin
     * handling the request. A scheduled transition runs inside core's queue
     * handler, and `content.example.article.published` belongs to the example
     * plugin however it was triggered.
     */
    pluginId?: string;
  },
): Promise<EventEmitResult> => {
  const name = contentEventName(definition.id, action) as VitNodeEventName;
  const events = c.get("events") as unknown as ContentEventEmitter;

  return await events.emit(name, payload, { pluginId: options?.pluginId });
};
