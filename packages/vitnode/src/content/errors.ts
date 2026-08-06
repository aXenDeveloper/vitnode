import type { ContentScheduleCode } from "./schedules";

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
