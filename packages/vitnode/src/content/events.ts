import type { ContentFieldName } from "./types";

export type ContentEventAction =
  | "created"
  | "deleted"
  | "published"
  | "restored"
  | "schedule_cancelled"
  | "scheduled"
  | "unpublished"
  | "updated";

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
  /**
   * The person who created the schedule that fired this, when one did.
   *
   * Absent on an interactive publish, so no existing listener sees a new field.
   * It is the only way to answer "the system did it, on whose instruction" -
   * the actor of a scheduled run is genuinely the system, and inventing a user
   * id there would be a lie in the audit trail.
   */
  scheduledBy?: null | number;
  /**
   * The booking that fired this, when one did - and the idempotency key for a
   * listener that must act exactly once.
   *
   * Scheduled announcements are delivered **at least** once: they run in a
   * queue task that retries whenever the event, the search write or a cache
   * origin failed, and a retry re-emits an event that may already have been
   * received. The id does not change between those attempts, so a listener that
   * records "I have handled schedule 55" can safely ignore the second copy.
   *
   * Absent on an interactive publish, which is emitted once by the route that
   * performed it and has no booking to point at.
   */
  scheduleId?: number;
}

export interface ContentUnpublishedPayload {
  contentId: number;
  /** As on `published`: who scheduled it, when a schedule fired it. */
  scheduledBy?: null | number;
  /** As on `published`: the booking, and the idempotency key for retries. */
  scheduleId?: number;
}

/**
 * A record was rolled back to the field values of an earlier revision.
 *
 * Emitted **instead of** `updated`, not alongside it - the one-event-per-mutation
 * rule below holds here too, and a listener that fired twice would do every
 * piece of downstream work twice. `changedFields` is carried for exactly that
 * reason: porting an `updated` listener is a rename, not a rewrite.
 *
 * There is deliberately no publication field. A restore never moves `status` or
 * `publishedAt`, so anyone listening for a visibility change still only has to
 * watch `published` and `unpublished`.
 */
export interface ContentRestoredPayload<TDefinition> {
  changedFields: ContentFieldName<TDefinition>[];
  contentId: number;
  /** The revision the values came from. */
  restoredFromRevisionId: number;
  /** The revision this restore itself created. */
  revisionId: number;
  version: number;
}

/**
 * A transition was booked for later, or the booking was called off.
 *
 * These are **not** revisions and consume no version: scheduling changes no
 * field value. When the schedule actually fires, the resulting transition emits
 * the ordinary `published`/`unpublished` event with `scheduledBy` set.
 */
export interface ContentScheduledPayload {
  action: "publish" | "unpublish";
  /** The staff member who booked it. */
  actorUserId: null | number;
  contentId: number;
  scheduledFor: Date;
  scheduleId: number;
}

export interface ContentScheduleCancelledPayload {
  action: "publish" | "unpublish";
  actorUserId: null | number;
  contentId: number;
  scheduleId: number;
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
 * The extra event the editorial workflow adds.
 *
 * Gated the same way the publication pair is, so a content type without
 * `editorial` gains no key at all and a listener for one cannot be registered.
 */
type ContentEditorialEventsFor<TDefinition extends { id: string }> =
  (TDefinition extends { editorial: { enabled: true } }
    ? Record<
        `content.${TDefinition["id"]}.restored`,
        ContentRestoredPayload<TDefinition>
      >
    : Record<never, never>) &
    (TDefinition extends { editorial: { scheduling: { enabled: true } } }
      ? Record<
          `content.${TDefinition["id"]}.schedule_cancelled`,
          ContentScheduleCancelledPayload
        > &
          Record<
            `content.${TDefinition["id"]}.scheduled`,
            ContentScheduledPayload
          >
      : Record<never, never>);

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
  ContentEditorialEventsFor<TDefinition> &
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
