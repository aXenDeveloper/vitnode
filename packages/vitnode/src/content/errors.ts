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
