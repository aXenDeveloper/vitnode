import type { ContentFieldName, ContentLocalizedFieldName } from "./types";

export type ContentEventAction =
  | "created"
  | "deleted"
  | "delivery_redirect_created"
  | "delivery_slug_changed"
  | "published"
  | "restored"
  | "schedule_cancelled"
  | "scheduled"
  | "translation_created"
  | "translation_deleted"
  | "translation_published"
  | "translation_restored"
  | "translation_unpublished"
  | "translation_updated"
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
 * What every translation event carries.
 *
 * `locale` first because it is the one field a listener always needs: an event
 * that said only "article 7 changed" would force every consumer to go and ask
 * which language, and half of them would forget. `languageId` rides along for
 * anything joining against `core_languages` directly.
 *
 * Deliberately **not** folded into `updated`. A shared update and a Polish
 * translation update are different domain facts with different consequences - one
 * invalidates every locale, the other invalidates one - and a listener that had to
 * inspect `changedFields` to tell them apart would get it wrong the first time a
 * field was renamed.
 */
export interface ContentTranslationEventPayload {
  contentId: number;
  languageId: number;
  /** The canonical `core_languages.code`. */
  locale: string;
  /** The version *this translation* holds after the mutation. */
  version: number;
}

export interface ContentTranslationCreatedPayload extends ContentTranslationEventPayload {
  /**
   * The revision this mutation wrote.
   *
   * Absent for a localized content type without `editorial`, which keeps no
   * history - optional rather than `0`, so a listener that acts on a revision
   * cannot be handed one that does not exist.
   */
  revisionId?: number;
}

export interface ContentTranslationUpdatedPayload<
  TDefinition,
> extends ContentTranslationEventPayload {
  /** Localized field names this write moved. Never a shared field. */
  changedFields: ContentLocalizedFieldName<TDefinition>[];
  revisionId?: number;
}

export interface ContentTranslationDeletedPayload extends ContentTranslationEventPayload {
  revisionId?: number;
}

export interface ContentTranslationPublishedPayload extends ContentTranslationEventPayload {
  /** When this language was first published; never rewritten. */
  publishedAt: Date | null;
  revisionId?: number;
}

export interface ContentTranslationUnpublishedPayload extends ContentTranslationEventPayload {
  revisionId?: number;
}

export interface ContentTranslationRestoredPayload<
  TDefinition,
> extends ContentTranslationEventPayload {
  changedFields: ContentLocalizedFieldName<TDefinition>[];
  /** The revision the values came from - always one of this locale's own. */
  restoredFromRevisionId: number;
  /** The revision this restore itself created. */
  revisionId: number;
}

/**
 * The six events a localized content type adds.
 *
 * Gated on `localization: { enabled: true }` exactly like the publication and
 * editorial pairs, so a content type without it gains no key at all and a
 * listener for one cannot be registered. That is what keeps every non-localized
 * payload byte-identical to what it was before Stage 5B.
 *
 * The three lifecycle events are gated a second time on publication: without it
 * there is no translation status to move.
 */
type ContentLocalizationEventsFor<TDefinition extends { id: string }> =
  (TDefinition extends {
    editorial: { enabled: true };
    localization: { enabled: true };
  }
    ? Record<
        `content.${TDefinition["id"]}.translation_restored`,
        ContentTranslationRestoredPayload<TDefinition>
      >
    : Record<never, never>) &
    (TDefinition extends {
      localization: { enabled: true };
      publication: { enabled: true };
    }
      ? Record<
          `content.${TDefinition["id"]}.translation_published`,
          ContentTranslationPublishedPayload
        > &
          Record<
            `content.${TDefinition["id"]}.translation_unpublished`,
            ContentTranslationUnpublishedPayload
          >
      : Record<never, never>) &
    (TDefinition extends { localization: { enabled: true } }
      ? Record<
          `content.${TDefinition["id"]}.translation_created`,
          ContentTranslationCreatedPayload
        > &
          Record<
            `content.${TDefinition["id"]}.translation_deleted`,
            ContentTranslationDeletedPayload
          > &
          Record<
            `content.${TDefinition["id"]}.translation_updated`,
            ContentTranslationUpdatedPayload<TDefinition>
          >
      : Record<never, never>);

/**
 * A record's canonical public URL moved.
 *
 * Emitted **in addition to** the `updated` (or `restored`) event, not instead of
 * it: the field mutation and the URL change are two different facts with two
 * different audiences. A listener that mirrors content into another system wants
 * the first; one that warms a CDN, tells an external search engine or writes to an
 * edge redirect table wants the second, and would otherwise have to inspect
 * `changedFields` for a slug field whose name it cannot know.
 *
 * `locale` is `null` when the slug is shared - a content type that is not
 * localized, or a localized one whose slug lives on the base row.
 */
export interface ContentDeliverySlugChangedPayload {
  /** The path the record answers to now. */
  canonicalPath: string;
  contentId: number;
  locale: null | string;
  /** The path it answered to before, or `null` when it had no public URL yet. */
  previousPath: null | string;
  previousSlug: null | string;
  slug: string;
}

/**
 * A historical public URL became a redirect.
 *
 * Emitted only when the old slug had genuinely been *publicly addressable* - so a
 * draft whose slug was corrected three times before it was ever published emits
 * nothing, and a published article that moves emits exactly one. That is the
 * difference between "a URL exists that needs a redirect" and "somebody edited a
 * field", and it is why this is a separate event from the one above rather than a
 * boolean on it.
 */
export interface ContentDeliveryRedirectCreatedPayload {
  /** Where the historical path now redirects to. */
  canonicalPath: string;
  contentId: number;
  locale: null | string;
  /** The retired path, which now answers with a permanent redirect. */
  previousPath: string;
  previousSlug: string;
}

/**
 * The two events the delivery layer adds.
 *
 * Gated on `delivery: { enabled: true }` exactly like the publication, editorial
 * and localization groups, so a content type without it gains no key at all and a
 * listener for one cannot be registered - which is what keeps every Stage 1-7
 * event map byte-identical.
 *
 * Both keys are gated on `delivery` alone rather than the redirect one being gated a
 * second time on `redirects`. Whether a content type keeps slug history is a
 * *resolved* boolean rather than a literal on the definition's type, so a second gate
 * would need another type parameter on `ContentTypeDefinition` to buy one thing: a
 * listener nobody can register for an event that would never have fired anyway.
 */
type ContentDeliveryEventsFor<TDefinition extends { id: string }> =
  TDefinition extends { delivery: { enabled: true } }
    ? Record<
        `content.${TDefinition["id"]}.delivery_redirect_created`,
        ContentDeliveryRedirectCreatedPayload
      > &
        Record<
          `content.${TDefinition["id"]}.delivery_slug_changed`,
          ContentDeliverySlugChangedPayload
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
  ContentDeliveryEventsFor<TDefinition> &
    ContentEditorialEventsFor<TDefinition> &
    ContentLocalizationEventsFor<TDefinition> &
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
