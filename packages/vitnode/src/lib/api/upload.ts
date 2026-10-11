import { randomUUID } from "node:crypto";

import { getFileExtension, replaceFileExtension } from "../file-extension";

export { getFileExtension, replaceFileExtension };

/** One path segment: letters, numbers, hyphens and underscores, never leading. */
const FOLDER_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;

/**
 * Time-based prefix every upload is grouped under, e.g. `2026/07`.
 * `Date#getMonth` is zero-based, so `+ 1` yields the human month number.
 */
export const buildDateFolder = (now: Date = new Date()): string => {
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Guards the caller-provided folder against path traversal.
 *
 * Nesting is allowed - `blog/posts` groups a plugin's uploads the way anybody
 * browsing a bucket would expect - and every **segment** has to satisfy the same
 * rule a single folder always did: it starts with a letter or a digit, and holds
 * nothing but letters, digits, hyphens and underscores.
 *
 * Checking per segment rather than with one relaxed pattern is what keeps this a
 * guard. `..` fails because it starts with a dot, `a//b` and `/a` and `a/` fail
 * on their empty segment, and a backslash fails inside its own segment - so
 * every way of climbing out of the prefix is refused by the same rule, rather
 * than by a list of the tricks somebody thought of.
 */
export const sanitizeFolder = (folder: string): string => {
  const segments = folder.split("/");

  if (!segments.every(segment => FOLDER_SEGMENT_PATTERN.test(segment))) {
    throw new Error(
      `Invalid storage folder name: "${folder}". Use only letters, numbers, hyphens and underscores, with "/" between segments.`,
    );
  }

  return folder;
};

const EXTENSIONS_BY_MIME: Record<string, readonly string[]> = {
  "application/json": [".json"],
  "application/pdf": [".pdf"],
  "application/zip": [".zip"],
  "audio/mpeg": [".mp3"],
  "audio/ogg": [".ogg"],
  "audio/wav": [".wav"],
  "image/avif": [".avif"],
  "image/gif": [".gif"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/svg+xml": [".svg"],
  "image/tiff": [".tif", ".tiff"],
  "image/webp": [".webp"],
  "text/csv": [".csv"],
  "text/plain": [".txt"],
  "video/mp4": [".mp4"],
  "video/webm": [".webm"],
};

const ACTIVE_CONTENT_EXTENSIONS = new Set([
  ".asp",
  ".aspx",
  ".cgi",
  ".cjs",
  ".htaccess",
  ".htm",
  ".html",
  ".jre",
  ".js",
  ".jsp",
  ".jspx",
  ".jsx",
  ".mjs",
  ".phar",
  ".php",
  ".php3",
  ".php4",
  ".php5",
  ".php7",
  ".phtml",
  ".pl",
  ".py",
  ".rb",
  ".sh",
  ".shtml",
  ".svgz",
  ".swf",
  ".xht",
  ".xhtml",
  ".xml",
  ".xsl",
  ".xslt",
]);

const NEUTRAL_EXTENSION = ".bin";

const WELL_FORMED_EXTENSION = /^\.[a-z0-9]{1,16}$/;

export const safeStorageExtension = (
  extension: string,
  mimeType?: null | string,
): string => {
  const normalized = extension.toLowerCase();
  const wellFormed = WELL_FORMED_EXTENSION.test(normalized) ? normalized : "";

  const type = mimeType?.toLowerCase().split(";")[0]?.trim();
  const allowed = type ? EXTENSIONS_BY_MIME[type] : undefined;

  if (allowed) {
    return allowed.includes(wellFormed) ? wellFormed : allowed[0];
  }

  if (!wellFormed || ACTIVE_CONTENT_EXTENSIONS.has(wellFormed)) {
    return NEUTRAL_EXTENSION;
  }

  return wellFormed;
};

export const generateStorageFileName = (
  originalName: string,
  extension?: string,
  mimeType?: null | string,
): string => {
  const chosen = extension ?? getFileExtension(originalName);

  return `${randomUUID()}${safeStorageExtension(chosen, mimeType)}`;
};

export const buildStorageKey = ({
  fileName,
  folder,
  now,
}: {
  fileName: string;
  folder: string;
  now?: Date;
}): string => {
  return `${buildDateFolder(now)}/${sanitizeFolder(folder)}/${fileName}`;
};

export const parseImageDimensions = (
  metadata: null | Record<string, unknown> | undefined,
): null | { height: number; width: number } => {
  if (!metadata) {
    return null;
  }
  const dimensions = metadata.dimensions;
  if (dimensions && typeof dimensions === "object") {
    const { height, width } = dimensions as {
      height?: unknown;
      width?: unknown;
    };
    if (typeof width === "number" && typeof height === "number") {
      return { width, height };
    }
  }

  return null;
};
