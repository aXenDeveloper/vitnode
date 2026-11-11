import { z } from "zod";

import type { EventDefinition } from "../api/lib/event-definition";
import type { ContentEventAction, ContentEventsFor } from "./events";
import type { AnyContentTypeDefinition } from "./types";

import { eventDate } from "../api/events/wire";

type ContentEventNameOf<
  TDefinition extends { id: string },
  TAction extends string,
> = `content.${TDefinition["id"]}.${TAction}`;

/**
 * The actions a content type emits, from the options it enables - the
 * `{action}` of every `content.{id}.{action}` in {@link ContentEventsFor}.
 */
export type ContentEventActionOf<TDefinition extends { id: string }> = {
  [K in keyof ContentEventsFor<TDefinition>]: K extends ContentEventNameOf<
    TDefinition,
    infer TAction extends ContentEventAction
  >
    ? TAction
    : never;
}[keyof ContentEventsFor<TDefinition>];

/** What listeners of `content.{id}.{action}` receive. */
export type ContentEventPayloadOf<
  TDefinition extends { id: string },
  TAction extends ContentEventAction,
> = ContentEventsFor<TDefinition>[ContentEventNameOf<TDefinition, TAction> &
  keyof ContentEventsFor<TDefinition>];

type ContentEventWireValue<TValue> = TValue extends Date ? string : TValue;

/** A content event payload on the JSON wire: every `Date` is an ISO string. */
export type ContentEventInput<TPayload> = {
  [K in keyof TPayload]: ContentEventWireValue<TPayload[K]>;
};

/** The event definition {@link contentEvent} returns for one content type and action. */
export type ContentEventDefinition<
  TDefinition extends { id: string },
  TAction extends ContentEventAction,
> = EventDefinition<
  string,
  ContentEventNameOf<TDefinition, TAction>,
  z.ZodType<
    ContentEventPayloadOf<TDefinition, TAction>,
    ContentEventInput<ContentEventPayloadOf<TDefinition, TAction>>
  >
>;

type ErasedContentEventSchema = z.ZodType<
  Record<string, unknown>,
  Record<string, unknown>
>;

/** A content event definition whose content type is not known statically. */
export type AnyContentEventDefinition = EventDefinition<
  string,
  string,
  ErasedContentEventSchema
>;

const definitionsByType = new WeakMap<
  AnyContentTypeDefinition,
  Map<ContentEventAction, AnyContentEventDefinition>
>();
const owners = new WeakMap<AnyContentTypeDefinition, string>();
const CONTENT_ENGINE_PLUGIN_ID = "@vitnode/core";

/**
 * Records the plugin that registered a content type, which owns its events.
 * Called by `buildApiPlugin` for every content type it registers.
 *
 * @internal
 */
export const registerContentEventOwner = (
  definition: AnyContentTypeDefinition,
  pluginId: string,
): void => {
  owners.set(definition, pluginId);
};

const payloadSchemaOf = (
  definition: AnyContentTypeDefinition,
  action: ContentEventAction,
): ErasedContentEventSchema => {
  const id = definition.idStrategy === "serial" ? z.number().int() : z.string();
  const fieldNames = new Set(Object.keys(definition.fields));
  const changedFields = z.array(
    z.string().refine(path => fieldNames.has(path.split(".")[0] ?? "")),
  );
  const int = z.number().int();
  const schedule = {
    scheduledBy: int.nullable().optional(),
    scheduleId: int.optional(),
  };
  const translation = {
    contentId: id,
    languageId: int,
    locale: z.string(),
    version: int,
  };

  switch (action) {
    case "created":
      return z.looseObject({ contentId: id, duplicatedFromId: id.optional() });
    case "deleted":
      return z.looseObject({ contentId: id });
    case "delivery_redirect_created":
      return z.looseObject({
        canonicalPath: z.string(),
        contentId: id,
        locale: z.string().nullable(),
        previousPath: z.string(),
        previousSlug: z.string(),
      });
    case "delivery_slug_changed":
      return z.looseObject({
        canonicalPath: z.string(),
        contentId: id,
        locale: z.string().nullable(),
        previousPath: z.string().nullable(),
        previousSlug: z.string().nullable(),
        slug: z.string(),
      });
    case "duplicated":
      return z.looseObject({
        actorUserId: int.nullable(),
        contentId: id,
        contentTypeId: z.string(),
        sourceId: id,
      });
    case "hidden":
      return z.looseObject({
        actorUserId: int.nullable(),
        contentId: id,
        hiddenAt: eventDate(),
      });
    case "published":
      return z.looseObject({
        contentId: id,
        publishedAt: eventDate(),
        ...schedule,
      });
    case "restored":
      return z.looseObject({
        changedFields,
        contentId: id,
        restoredFromRevisionId: int,
        revisionId: int,
        version: int,
      });
    case "schedule_cancelled":
      return z.looseObject({
        action: z.enum(["publish", "unpublish"]),
        actorUserId: int.nullable(),
        contentId: id,
        scheduleId: int,
      });
    case "scheduled":
      return z.looseObject({
        action: z.enum(["publish", "unpublish"]),
        actorUserId: int.nullable(),
        contentId: id,
        scheduledFor: eventDate(),
        scheduleId: int,
      });
    case "translation_created":
    case "translation_deleted":
    case "translation_unpublished":
      return z.looseObject({ ...translation, revisionId: int.optional() });
    case "translation_published":
      return z.looseObject({
        ...translation,
        publishedAt: eventDate().nullable(),
        revisionId: int.optional(),
      });
    case "translation_restored":
      return z.looseObject({
        ...translation,
        changedFields,
        restoredFromRevisionId: int,
        revisionId: int,
      });
    case "translation_updated":
      return z.looseObject({
        ...translation,
        changedFields,
        revisionId: int.optional(),
      });
    case "unhidden":
      return z.looseObject({ actorUserId: int.nullable(), contentId: id });
    case "unpublished":
      return z.looseObject({ contentId: id, ...schedule });
    case "updated":
      return z.looseObject({ changedFields, contentId: id });
  }
};

/**
 * The event definition of `content.{definition.id}.{action}` for any content
 * type - one stable object per pair. Prefer {@link contentEvent}, which types
 * the payload; this is for code that handles content types generically.
 */
export const contentEventDefinitionOf = (
  definition: AnyContentTypeDefinition,
  action: ContentEventAction,
): AnyContentEventDefinition => {
  let byAction = definitionsByType.get(definition);
  if (byAction === undefined) {
    byAction = new Map();
    definitionsByType.set(definition, byAction);
  }

  const existing = byAction.get(action);
  if (existing !== undefined) return existing;

  const created: AnyContentEventDefinition = Object.freeze({
    name: `content.${definition.id}.${action}`,
    payload: payloadSchemaOf(definition, action),
    get pluginId(): string {
      return owners.get(definition) ?? CONTENT_ENGINE_PLUGIN_ID;
    },
  });
  byAction.set(action, created);

  return created;
};

/**
 * The actions a content type emits at runtime - the same gates as
 * {@link ContentEventsFor}.
 */
export const contentEventActionsOf = (
  definition: AnyContentTypeDefinition,
): ContentEventAction[] => {
  const publication = definition.publication.enabled;
  const editorial = definition.editorial.enabled;
  const localization = definition.localization.enabled;

  return [
    "created",
    "deleted",
    "updated",
    ...(publication ? (["published", "unpublished"] as const) : []),
    ...(editorial ? (["restored"] as const) : []),
    ...(definition.editorial.scheduling.enabled
      ? (["scheduled", "schedule_cancelled"] as const)
      : []),
    ...(localization
      ? ([
          "translation_created",
          "translation_deleted",
          "translation_updated",
        ] as const)
      : []),
    ...(localization && publication
      ? (["translation_published", "translation_unpublished"] as const)
      : []),
    ...(localization && editorial ? (["translation_restored"] as const) : []),
    ...(definition.delivery.enabled
      ? (["delivery_slug_changed", "delivery_redirect_created"] as const)
      : []),
    ...(definition.duplication.enabled ? (["duplicated"] as const) : []),
    ...(definition.visibility.enabled ? (["hidden", "unhidden"] as const) : []),
  ];
};

/**
 * The event definition of a Content Engine event, `content.{id}.{action}`:
 * emitted by the generated routes and `emitContentEvent`, owned by the plugin
 * that registers the content type (`buildApiPlugin`), and registered for you.
 * One stable object per content type and action, so every import of it is the
 * same definition.
 *
 * The payload is validated against a schema built from the content type -
 * `contentId` follows its `idStrategy`, `changedFields` names its own fields -
 * and listeners receive it typed as {@link ContentEventsFor} declares, with
 * dates as `Date`. Only the actions the content type enables are accepted.
 * Universal.
 *
 * @example
 * ```ts
 * import { buildEventListener } from "@vitnode/core/api/lib/events";
 * import { contentEvent } from "@vitnode/core/content";
 *
 * import { articleContentType } from "@/content/article";
 *
 * export const articlePublishedListener = buildEventListener({
 *   event: contentEvent(articleContentType, "published"),
 *   name: "announce-article",
 *   handler: async (c, payload) => {
 *     await c.get("log").debug(`Article ${payload.contentId} is live`);
 *   },
 * });
 * ```
 */
export const contentEvent = <
  const TDefinition extends AnyContentTypeDefinition,
  TAction extends ContentEventActionOf<TDefinition>,
>(
  definition: TDefinition,
  action: TAction,
): ContentEventDefinition<TDefinition, TAction> =>
  contentEventDefinitionOf(
    definition,
    action,
  ) as unknown as ContentEventDefinition<TDefinition, TAction>;
