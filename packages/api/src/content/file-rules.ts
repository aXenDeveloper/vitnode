import {
  CONTENT_FILE_EXTENSION_PATTERN,
  CONTENT_FILE_MIME_PATTERN,
} from "./const";
import { ContentEngineError } from "./errors";

export const normalizeContentFileExtension = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new ContentEngineError(
      `allowedExtensions holds ${typeof value === "object" ? "an object" : `a ${typeof value}`}. Every entry must be a string like ".gif".`,
    );
  }

  const trimmed = value.trim().toLowerCase();
  const dotted = trimmed.startsWith(".") ? trimmed : `.${trimmed}`;

  if (!CONTENT_FILE_EXTENSION_PATTERN.test(dotted)) {
    throw new ContentEngineError(
      `allowedExtensions has the entry "${value}", which is not a file extension. Write one dot-prefixed segment of letters or digits, e.g. ".gif" - case does not matter, and a bare "gif" is accepted too.`,
    );
  }

  return dotted;
};

/**
 * Every extension rule, normalised and deduplicated.
 *
 * Deduplication is what makes `["GIF", ".gif"]` one rule rather than two - the
 * author wrote the same thing twice, which is a typo rather than a decision.
 * An **empty** list is refused: it reads as an allowlist and behaves as a
 * blocklist of everything, and a field nobody can upload to is never what
 * somebody meant.
 */
export const normalizeContentFileExtensions = (
  values: readonly unknown[],
): string[] => {
  if (values.length === 0) {
    throw new ContentEngineError(
      "allowedExtensions is empty, which would refuse every file. Omit the option to allow any extension, or list the ones you mean.",
    );
  }

  return [...new Set(values.map(normalizeContentFileExtension))];
};

/** One MIME rule, lowercased and checked for the `type/subtype` shape. */
export const normalizeContentFileMimeType = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new ContentEngineError(
      `allowedMimeTypes holds ${typeof value === "object" ? "an object" : `a ${typeof value}`}. Every entry must be a string like "image/gif".`,
    );
  }

  const normalized = value.trim().toLowerCase();

  if (!CONTENT_FILE_MIME_PATTERN.test(normalized)) {
    throw new ContentEngineError(
      `allowedMimeTypes has the entry "${value}", which is not a media type. Write "type/subtype", e.g. "image/gif" - no wildcards and no parameters.`,
    );
  }

  return normalized;
};

export const normalizeContentFileMimeTypes = (
  values: readonly unknown[],
): string[] => {
  if (values.length === 0) {
    throw new ContentEngineError(
      "allowedMimeTypes is empty, which would refuse every file. Omit the option to allow any type, or list the ones you mean.",
    );
  }

  return [...new Set(values.map(normalizeContentFileMimeType))];
};

export const assertContentFileMaxBytes = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ContentEngineError(
      "field.file() needs `maxBytes` - the largest upload it will accept, in bytes. There is no unlimited file field.",
    );
  }

  if (!Number.isInteger(value)) {
    throw new ContentEngineError(
      `field.file() has \`maxBytes: ${value}\`, which is not a whole number of bytes.`,
    );
  }

  if (value <= 0) {
    throw new ContentEngineError(
      `field.file() has \`maxBytes: ${value}\`. It must be greater than zero - a field that accepts nothing is not a field.`,
    );
  }

  return value;
};
