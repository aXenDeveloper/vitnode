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
