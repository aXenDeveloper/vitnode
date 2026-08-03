import type { ContentFieldName } from "./types";

export type ContentEventAction =
  "created" | "deleted" | "published" | "unpublished" | "updated";

export interface ContentCreatedPayload {
  contentId: number;
}

export interface ContentDeletedPayload {
  contentId: number;
}

export interface ContentUpdatedPayload<TDefinition> {
  changedFields: ContentFieldName<TDefinition>[];
  contentId: number;
}

export interface ContentPublishedPayload {
  contentId: number;
  /** When the row was published for the *first* time; never rewritten. */
  publishedAt: Date;
}

export interface ContentUnpublishedPayload {
  contentId: number;
}

/**
 * The two extra events a content type with `publication` emits.
 *
 * They are disjoint from `updated`: `status` and `publishedAt` are generated
 * columns, not declared fields, so an `updated` event alongside them would
 * carry an empty `changedFields` and lie about what moved. Exactly one event is
 * emitted per mutation, and a no-op publish emits nothing at all.
 */
type ContentPublicationEventsFor<TDefinition extends { id: string }> =
  TDefinition extends { publication: { enabled: true } }
    ? Record<
        `content.${TDefinition["id"]}.published`,
        ContentPublishedPayload
      > &
        Record<
          `content.${TDefinition["id"]}.unpublished`,
          ContentUnpublishedPayload
        >
    : Record<never, never>;

/**
 * The events a content type emits, as a literal-keyed map.
 *
 * Plugins graft these onto the global event map with one declaration - the
 * same module-augmentation mechanism every other VitNode event uses:
 *
 * ```ts
 * declare module "@vitnode/core/api/models/events" {
 *   interface VitNodeEvents
 *     extends ContentEventsFor<typeof articleContentType> {}
 * }
 * ```
 *
 * `TDefinition` is concrete at the augmentation site, so the keys are
 * statically known and `changedFields` narrows to the content type's own field
 * names. The envelope already carries the actor, plugin and timestamp, so the
 * payloads stay minimal.
 */
export type ContentEventsFor<TDefinition extends { id: string }> =
  ContentPublicationEventsFor<TDefinition> &
    Record<`content.${TDefinition["id"]}.created`, ContentCreatedPayload> &
    Record<`content.${TDefinition["id"]}.deleted`, ContentDeletedPayload> &
    Record<
      `content.${TDefinition["id"]}.updated`,
      ContentUpdatedPayload<TDefinition>
    >;

export const contentEventName = <
  TId extends string,
  TAction extends ContentEventAction,
>(
  contentTypeId: TId,
  action: TAction,
): `content.${TId}.${TAction}` => `content.${contentTypeId}.${action}`;
