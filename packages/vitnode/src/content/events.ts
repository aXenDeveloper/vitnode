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

  scheduledBy?: null | number;

  scheduleId?: number;
}

export interface ContentUnpublishedPayload {
  contentId: number;
  /** As on `published`: who scheduled it, when a schedule fired it. */
  scheduledBy?: null | number;
  /** As on `published`: the booking, and the idempotency key for retries. */
  scheduleId?: number;
}

export interface ContentRestoredPayload<TDefinition> {
  changedFields: ContentFieldName<TDefinition>[];
  contentId: number;
  /** The revision the values came from. */
  restoredFromRevisionId: number;
  /** The revision this restore itself created. */
  revisionId: number;
  version: number;
}

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
