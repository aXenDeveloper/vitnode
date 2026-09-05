import { z } from "zod";

import type {
  FileCandidate,
  FileConstraints,
  FileRejectionReason,
} from "../lib/file-constraints";
import type { ContentFileField } from "./types";

import {
  fileAcceptAttribute,
  fileFormatLabels,
  validateFile,
} from "../lib/file-constraints";
import {
  CONTENT_FILE_CODES,
  CONTENT_FILE_EXTENSION_PATTERN,
  CONTENT_FILE_MIME_PATTERN,
  CONTENT_FILE_PLUGIN_SEPARATOR,
} from "./const";
import { ContentEngineError } from "./errors";

export interface ContentFileDescriptor {
  height?: number;
  id: number;
  mimeType: null | string;
  name: string;
  size: number;
  url: string;
  width?: number;
}

export const zodContentFileDescriptor = z.strictObject({
  height: z.number().int().positive().optional(),
  id: z.number().int().positive(),
  mimeType: z.string().nullable(),
  name: z.string(),
  size: z.number().int().nonnegative(),
  url: z.string(),
  width: z.number().int().positive().optional(),
});

export type ContentFileFieldValue =
  ContentFileDescriptor | ContentFileDescriptor[] | null;

/** The response schema for {@link ContentFileFieldValue}. */
export const zodContentFileFieldValue = z.union([
  zodContentFileDescriptor.nullable(),
  z.array(zodContentFileDescriptor),
]);

export type ContentFileCode =
  (typeof CONTENT_FILE_CODES)[keyof typeof CONTENT_FILE_CODES];

/** Why a file was refused, in a shape both the upload and the save can answer. */
export interface ContentFileRejection {
  code: ContentFileCode;
  /** Written for the person who picked the file - nothing internal in it. */
  message: string;
}

export const zodContentFileReferenceRejection = z.strictObject({
  code: z.string(),
  field: z.string(),
  message: z.string(),
});

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

export type ContentFileConstraints = FileConstraints;

/** One file's identity, as either side of the wire can describe it. */
export type ContentFileCandidate = FileCandidate;

export const validateContentFile = (
  constraints: ContentFileConstraints,
  file: ContentFileCandidate,
): ContentFileRejection | null => {
  const rejection = validateFile(constraints, file);
  if (!rejection) return null;

  return {
    code: CONTENT_FILE_CODES[rejection.reason],
    message: rejection.message,
  };
};

export const contentFileAccept = fileAcceptAttribute;

export const contentFileFormatLabels = fileFormatLabels;

export const contentFileRejectionReason = (
  code: string,
): FileRejectionReason | undefined => {
  switch (code) {
    case CONTENT_FILE_CODES.extension:
      return "extension";
    case CONTENT_FILE_CODES.mimeType:
      return "mimeType";
    case CONTENT_FILE_CODES.size:
      return "size";
    default:
      return undefined;
  }
};

export const contentFileFolder = ({
  module,
  pluginId,
}: {
  module: string;
  pluginId: string;
}): string => {
  const plugin = pluginId
    .toLowerCase()
    // The scope separator becomes a hyphen; the leading `@` and anything else a
    // segment may not hold go the same way, collapsed and trimmed so a package
    // name can never produce an empty segment or a double hyphen.
    .replace(/[^a-z0-9]+/g, CONTENT_FILE_PLUGIN_SEPARATOR)
    .replace(/^-+|-+$/g, "");

  if (plugin === "") {
    throw new ContentEngineError(
      `Plugin id "${pluginId}" has no letters or digits in it, so it cannot name a storage folder.`,
    );
  }

  return `${plugin}/${module}`;
};

/** The constraints of one descriptor, without the rest of it. */
export const contentFileConstraints = (
  fieldValue: ContentFileField,
): ContentFileConstraints => ({
  ...(fieldValue.allowedExtensions
    ? { allowedExtensions: fieldValue.allowedExtensions }
    : {}),
  ...(fieldValue.allowedMimeTypes
    ? { allowedMimeTypes: fieldValue.allowedMimeTypes }
    : {}),
  maxBytes: fieldValue.maxBytes,
});
