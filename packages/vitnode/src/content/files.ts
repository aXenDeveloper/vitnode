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

/**
 * A stored file, as every surface is allowed to see it.
 *
 * The allowlist *is* the type: `key`, `userId`, `pluginId` and the raw
 * `metadata` bag are absent, so a projection cannot leak the object's storage
 * address or who uploaded it by forwarding "the file row". `width` and `height`
 * are present only for an image the storage pipeline measured.
 */
export interface ContentFileDescriptor {
  height?: number;
  id: number;
  mimeType: null | string;
  name: string;
  size: number;
  url: string;
  width?: number;
}

/**
 * The response and projection schema for {@link ContentFileDescriptor}.
 *
 * `strictObject`, so a key added to `core_files` cannot reach a client by being
 * spread into a descriptor somewhere: it would fail the parse the generated
 * route runs, which is the loud version of a leak.
 */
export const zodContentFileDescriptor = z.strictObject({
  height: z.number().int().positive().optional(),
  id: z.number().int().positive(),
  mimeType: z.string().nullable(),
  name: z.string(),
  size: z.number().int().nonnegative(),
  url: z.string(),
  width: z.number().int().positive().optional(),
});

/**
 * What one field's entry in a row's `files` sibling holds.
 *
 * A union rather than two keys, because the field name is the same either way
 * and its arity is a property of the *field*: a single file field is a descriptor
 * or `null`, and a `multiple: true` one is a list in stored order - empty when
 * the record has no files, absent when the response did not load the collection
 * at all (an admin list does not, by design).
 */
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

/**
 * The 400 body a **content write** answers when a file identifier is refused.
 *
 * `field` is what the upload route's own rejection does not need and this one
 * cannot do without: an upload is for one named field already in the URL, while
 * a save carries every field at once, so without it a form knows a file was
 * refused but not which input to say so under.
 *
 * `code` is a plain string rather than an enum of the four a reference check can
 * produce - `CONTENT_FILE_NOT_FOUND`, `CONTENT_FILE_TOO_LARGE`,
 * `CONTENT_FILE_MIME_TYPE_NOT_ALLOWED`, `CONTENT_FILE_EXTENSION_NOT_ALLOWED` -
 * for the same reason the upload route's is: a client that does not recognise a
 * code shows `message`, so a new one must not break the parse it arrives in.
 */
export const zodContentFileReferenceRejection = z.strictObject({
  code: z.string(),
  field: z.string(),
  message: z.string(),
});

/**
 * One extension rule, normalised.
 *
 * `GIF`, `.gif` and `.Gif` all become `.gif`, so the rule an author writes and
 * the extension a browser hands over are compared in one vocabulary. Anything
 * that cannot be an extension is a definition-time error rather than a rule that
 * silently matches nothing.
 */
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

/**
 * Checks `maxBytes`, which every file field has to declare.
 *
 * There is deliberately no unlimited Content Engine file field: the ceiling is
 * the only thing standing between a form and an upload that fills the disk, and
 * a default would be a number nobody chose applied to every field in every
 * plugin.
 */
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

/**
 * The three rules a file is checked against, whoever is asking.
 *
 * An alias rather than a second declaration: the rules live in
 * `lib/file-constraints`, with no Content Engine behind them, because
 * `AutoFormFile` checks the very same three things in the browser and a form
 * field must not have to import the Content Engine to do it.
 */
export type ContentFileConstraints = FileConstraints;

/** One file's identity, as either side of the wire can describe it. */
export type ContentFileCandidate = FileCandidate;

/**
 * Checks a file against a field's constraints, or returns `null`.
 *
 * A thin mapping over {@link validateFile}, which is the **one** implementation
 * of the rules - shared with `AutoFormFile`, so the browser's pre-flight check
 * and the server's authoritative one cannot answer differently. All this adds is
 * the machine-readable code, which is a Content Engine contract rather than a
 * property of files.
 */
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

/**
 * The `accept` attribute for a native file picker.
 *
 * UX only - see {@link fileAcceptAttribute}. The server validates the same three
 * rules again, whatever a dialog let through.
 */
export const contentFileAccept = fileAcceptAttribute;

/**
 * The formats a field accepts, as somebody would say them out loud.
 *
 * `JPG, PNG, WEBP` rather than raw media types - see {@link fileFormatLabels},
 * which the AdminCP constraint line reads through the very same function.
 */
export const contentFileFormatLabels = fileFormatLabels;

/**
 * The rule a rejection code came from, or `undefined`.
 *
 * The inverse of the mapping in {@link validateContentFile}, and it exists for
 * the browser: a rejection that arrives over the wire is a code and an English
 * sentence, and the uploader would rather render its *own* translated sentence -
 * built from the field's own limits, which it already has.
 *
 * Anything the client cannot improve on comes back `undefined`, and the server's
 * message is shown verbatim. That is the right default: "Storage provider not
 * found" is far more use to an admin than any sentence this side could invent.
 */
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

/**
 * The storage folder one content type's uploads land in: `{plugin}/{module}`.
 *
 * `@vitnode/blog` + `posts` -> `vitnode-blog/posts`, so the object key reads
 * `month_8_2026/vitnode-blog/posts/<uuid>.webp`. Grouping by owner rather than
 * dropping everything in one `content/` folder is what makes a bucket listing
 * answer "what is this?" - and it is the only place that question can be
 * answered cheaply, since a storage provider has no join back to `core_files`.
 *
 * The **module**, not the content type id: an id holds a dot (`blog.post`), which
 * a folder segment may not, and the module is already the path segment every
 * admin request for this content type goes through - including the upload itself
 * (`/admin/content/{module}/uploads/{field}`). So the key and the route agree by
 * construction rather than by two slugifiers happening to match.
 *
 * Nothing else is in it. The field name would put a second fact in the key that
 * `core_files.metadata` already records, and a record id would make moving a file
 * between records a copy.
 *
 * The result is always a folder `sanitizeFolder` accepts, and neither half of
 * that is luck: the plugin half is reduced to one segment and refused if nothing
 * is left, and the module half is checked against `CONTENT_TABLE_NAME_PATTERN` at
 * definition time - a stricter rule than the storage guard's. So a misconfigured
 * plugin fails at import rather than on somebody's first upload.
 */
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
