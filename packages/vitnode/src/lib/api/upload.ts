import { getMonth, getYear } from "date-fns";
import { randomUUID } from "node:crypto";

import { getFileExtension, replaceFileExtension } from "../file-extension";

export { getFileExtension, replaceFileExtension };

/** One path segment: letters, numbers, hyphens and underscores, never leading. */
const FOLDER_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;

/**
 * Time-based prefix every upload is grouped under, e.g. `month_7_2026`.
 * `getMonth` is zero-based, so `+ 1` yields the human month number.
 */
export const buildMonthFolder = (now: Date = new Date()): string => {
  return `month_${getMonth(now) + 1}_${getYear(now)}`;
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

export const generateStorageFileName = (
  originalName: string,
  extension?: string,
): string => {
  return `${randomUUID()}${extension ?? getFileExtension(originalName)}`;
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
  return `${buildMonthFolder(now)}/${sanitizeFolder(folder)}/${fileName}`;
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
