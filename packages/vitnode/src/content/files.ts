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
import { CONTENT_FILE_CODES, CONTENT_FILE_PLUGIN_SEPARATOR } from "./const";
import { ContentEngineError } from "./errors";
export {
  assertContentFileMaxBytes,
  normalizeContentFileExtension,
  normalizeContentFileExtensions,
  normalizeContentFileMimeType,
  normalizeContentFileMimeTypes,
} from "./file-rules";

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
