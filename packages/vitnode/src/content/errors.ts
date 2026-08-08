import type { CONTENT_ADVANCED_CODES } from "./const";
import type { ContentScheduleCode } from "./schedules";

export type ContentAdvancedCode =
  (typeof CONTENT_ADVANCED_CODES)[keyof typeof CONTENT_ADVANCED_CODES];

/**
 * Thrown while a content type definition is being built or registered - always
 * at import/boot time, never per request. The message names the offending
 * content type so a misconfigured plugin fails loudly and obviously.
 */
export class ContentEngineError extends Error {
  constructor(
    message: string,
    options?: { cause?: unknown; contentTypeId?: string },
  ) {
    super(
      options?.contentTypeId
        ? `[Content Engine] ${options.contentTypeId}: ${message}`
        : `[Content Engine] ${message}`,
      { cause: options?.cause },
    );

    this.name = "ContentEngineError";
    this.contentTypeId = options?.contentTypeId;
  }

  readonly contentTypeId: string | undefined;
}

/**
 * A payload the engine understood but cannot write - today, a slug that
 * normalises to nothing.
 *
 * The only per-request member of the family, and the only one whose message is
 * meant for the client: it says which field is wrong and what to do about it,
 * with nothing internal in it. The generated routes turn it into a 400, where
 * every other `ContentEngineError` is a configuration bug and becomes a 500.
 */
export class ContentInputError extends ContentEngineError {
  constructor(
    message: string,
    options?: { cause?: unknown; contentTypeId?: string },
  ) {
    super(message, options);

    this.name = "ContentInputError";
  }
}

/**
 * A write lost the race: the record moved between the read the editor started
 * from and the write they just sent.
 *
 * Per-request like {@link ContentInputError}, and carries both versions rather
 * than only a message - the AdminCP reloads the newer row and shows what
 * changed, which it cannot do from prose. The generated routes turn it into a
 * structured 409; nothing from the driver is in it.
 */
export class ContentVersionConflict extends ContentEngineError {
  constructor({
    contentTypeId,
    currentVersion,
    expectedVersion,
    itemId,
  }: {
    contentTypeId: string;
    currentVersion: number;
    expectedVersion: number;
    itemId: number;
  }) {
    super(
      `This record is at version ${currentVersion}, not ${expectedVersion}. Someone else saved it first.`,
      { contentTypeId },
    );

    this.name = "ContentVersionConflict";
    this.currentVersion = currentVersion;
    this.expectedVersion = expectedVersion;
    this.itemId = itemId;
  }

  readonly currentVersion: number;
  readonly expectedVersion: number;
  readonly itemId: number;
}

/**
 * A revision that cannot be applied to the record as it stands today.
 *
 * Thrown before anything is written, so a restore is all or nothing. `fields`
 * names the content type's own fields and nothing else - never a Zod issue
 * tree, which would leak internal paths.
 */
export class ContentRevisionNotRestorable extends ContentEngineError {
  constructor({
    contentTypeId,
    fields,
    revisionId,
  }: {
    contentTypeId: string;
    fields: string[];
    revisionId: number;
  }) {
    super(
      `Revision ${revisionId} cannot be restored: ${fields.join(", ")} ${fields.length === 1 ? "is" : "are"} no longer valid for this content type.`,
      { contentTypeId },
    );

    this.name = "ContentRevisionNotRestorable";
    this.fields = fields;
    this.revisionId = revisionId;
  }

  readonly fields: string[];
  readonly revisionId: number;
}

/**
 * A translation write lost the race against another edit of the *same locale*.
 *
 * Separate from {@link ContentVersionConflict} because the two guard different
 * rows and mean different things to an editor: the base row's version is shared
 * by everybody, a translation's belongs to one language. Somebody editing Polish
 * must never be told the English copy moved.
 */
export class ContentTranslationVersionConflict extends ContentEngineError {
  constructor({
    contentTypeId,
    currentVersion,
    expectedVersion,
    itemId,
    locale,
  }: {
    contentTypeId: string;
    currentVersion: number;
    expectedVersion: number;
    itemId: number;
    locale: string;
  }) {
    super(
      `The ${locale} translation is at version ${currentVersion}, not ${expectedVersion}. Someone else saved it first.`,
      { contentTypeId },
    );

    this.name = "ContentTranslationVersionConflict";
    this.currentVersion = currentVersion;
    this.expectedVersion = expectedVersion;
    this.itemId = itemId;
    this.locale = locale;
  }

  readonly currentVersion: number;
  readonly expectedVersion: number;
  readonly itemId: number;
  readonly locale: string;
}

/**
 * An attempt to remove the one translation a record cannot be without.
 *
 * The default-locale translation is created in the same transaction as the base
 * row, which is what lets every later stage assume a record always resolves in
 * at least one language. Deleting it would break that invariant silently - the
 * row would still be there, addressable, and empty in every language.
 */
export class ContentDefaultTranslationRequired extends ContentEngineError {
  constructor({
    contentTypeId,
    itemId,
    locale,
  }: {
    contentTypeId: string;
    itemId: number;
    locale: string;
  }) {
    super(
      `"${locale}" is the default locale, so its translation cannot be deleted. Delete the record itself, or change the content type's default locale first.`,
      { contentTypeId },
    );

    this.name = "ContentDefaultTranslationRequired";
    this.itemId = itemId;
    this.locale = locale;
  }

  readonly itemId: number;
  readonly locale: string;
}

/**
 * A create for a locale that already has a translation.
 *
 * Its own error rather than a bare unique violation: "switch to the tab that
 * exists" and "that slug is taken" are different instructions, and the composite
 * primary key cannot tell a client which one it hit.
 */
export class ContentTranslationExists extends ContentEngineError {
  constructor({
    contentTypeId,
    itemId,
    locale,
  }: {
    contentTypeId: string;
    itemId: number;
    locale: string;
  }) {
    super(
      `This record already has a "${locale}" translation. Update it instead of creating a second one.`,
      { contentTypeId },
    );

    this.name = "ContentTranslationExists";
    this.itemId = itemId;
    this.locale = locale;
  }

  readonly itemId: number;
  readonly locale: string;
}

/**
 * A locale that does not name a usable language.
 *
 * `reason` is what the routes branch on: an unknown locale is a 404 (there is no
 * such thing to address), a disabled one is a 409 (it exists, and this install
 * has switched it off). Both are per-request, and neither carries anything
 * beyond the locale the caller already sent.
 */
export class ContentLanguageError extends ContentEngineError {
  constructor({
    contentTypeId,
    locale,
    reason,
  }: {
    contentTypeId?: string;
    locale: string;
    reason: "disabled" | "missing";
  }) {
    super(
      reason === "missing"
        ? `Unknown locale "${locale}". Add the language in AdminCP -> Languages first.`
        : `Locale "${locale}" is disabled on this installation, so its content cannot be written.`,
      { contentTypeId },
    );

    this.name = "ContentLanguageError";
    this.locale = locale;
    this.reason = reason;
  }

  readonly locale: string;
  readonly reason: "disabled" | "missing";
}

/**
 * A translation write for a base record that is not there.
 *
 * Checked before the insert rather than left to the foreign key: the driver's
 * `23503` cannot say *which* of the two references failed, and "the article is
 * gone" and "that language is gone" want different answers.
 */
export class ContentTranslationItemMissing extends ContentEngineError {
  constructor({
    contentTypeId,
    itemId,
  }: {
    contentTypeId: string;
    itemId: number;
  }) {
    super(`No record with id ${itemId} to translate.`, { contentTypeId });

    this.name = "ContentTranslationItemMissing";
    this.itemId = itemId;
  }

  readonly itemId: number;
}

/**
 * A collection write the engine understood but cannot apply: a relation target
 * that does not exist, or a repeatable child that belongs to another record.
 *
 * Per-request, like {@link ContentInputError}, and checked **before** anything is
 * written so a collection mutation stays all or nothing. It exists rather than
 * leaving the foreign key to fail because the driver's `23503` cannot say which
 * of a junction row's two references was the bad one - and "category 99 is gone"
 * and "article 99 is gone" want different answers.
 *
 * `ids` names the offending identifiers and nothing else. It is the caller's own
 * input echoed back, so there is nothing internal in it for a client to read.
 */
export class ContentAdvancedInputError extends ContentInputError {
  constructor({
    code,
    contentTypeId,
    field,
    ids,
    message,
  }: {
    code: ContentAdvancedCode;
    contentTypeId: string;
    field: string;
    ids: number[];
    message: string;
  }) {
    super(message, { contentTypeId });

    this.name = "ContentAdvancedInputError";
    this.code = code;
    this.field = field;
    this.ids = ids;
  }

  readonly code: ContentAdvancedCode;
  readonly field: string;
  readonly ids: number[];
}

/**
 * A slug that another record's public URL history already owns.
 *
 * A historical public URL stays reserved for the content type and locale that
 * retired it, for as long as redirects are enabled, and this is what enforces
 * that. Without the reservation `/articles/hello` could stop redirecting to the
 * article it belonged to and start resolving to an unrelated one - so every link,
 * bookmark and search result pointing at it would silently change meaning.
 *
 * Per-request, like {@link ContentInputError}, and structured for the same reason
 * {@link ContentVersionConflict} is: the AdminCP points at the slug field and says
 * which URL is taken, which it cannot do from prose. Everything it carries is the
 * caller's own input echoed back plus the content type id, so there is nothing
 * internal in it - in particular never the owning record's identifier, which would
 * let a public write probe for records it cannot read.
 */
export class ContentDeliverySlugReserved extends ContentEngineError {
  constructor({
    contentTypeId,
    locale,
    slug,
  }: {
    contentTypeId: string;
    locale: null | string;
    slug: string;
  }) {
    super(
      locale === null
        ? `The address "${slug}" is reserved: another record used it publicly and it still redirects there. Pick a different one.`
        : `The address "${slug}" is reserved in "${locale}": another record used it publicly and it still redirects there. Pick a different one.`,
      { contentTypeId },
    );

    this.name = "ContentDeliverySlugReserved";
    this.locale = locale;
    this.slug = slug;
  }

  readonly locale: null | string;
  readonly slug: string;
}

/**
 * A delivery operation on a content type that has no delivery layer.
 *
 * A configuration bug rather than a per-request one - the model exposes no
 * `deliveryService` at all for such a content type, so reaching this means
 * somebody built the service by hand.
 */
export class ContentDeliveryNotEnabled extends ContentEngineError {
  constructor({ contentTypeId }: { contentTypeId: string }) {
    super(
      "This content type has no `delivery` block, so it has no canonical URL, no slug history and no sitemap. Add `delivery: { enabled: true }` to generate them.",
      { contentTypeId },
    );

    this.name = "ContentDeliveryNotEnabled";
  }
}

/**
 * A schedule that does not make sense: a time already past, or an unpublish
 * that would fire before the publish it is meant to follow.
 *
 * Carries a `code` rather than only prose, because the AdminCP shows a
 * different message - and points at a different field - for each one, and
 * because the same rule runs client-side before the round trip.
 */
export class ContentScheduleError extends ContentEngineError {
  constructor(
    message: string,
    {
      code,
      contentTypeId,
    }: { code: ContentScheduleCode; contentTypeId: string },
  ) {
    super(message, { contentTypeId });

    this.name = "ContentScheduleError";
    this.code = code;
  }

  readonly code: ContentScheduleCode;
}
