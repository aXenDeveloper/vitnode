import { getMonth, getYear } from "date-fns";
import { randomUUID } from "node:crypto";

const FOLDER_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;

/**
 * Time-based prefix every upload is grouped under, e.g. `month_7_2026`.
 * `getMonth` is zero-based, so `+ 1` yields the human month number.
 */
export const buildMonthFolder = (now: Date = new Date()): string => {
  return `month_${getMonth(now) + 1}_${getYear(now)}`;
};

/**
 * Guards the caller-provided folder against path traversal - only a single
 * path segment of letters, numbers, hyphens and underscores is allowed.
 */
export const sanitizeFolder = (folder: string): string => {
  if (!FOLDER_PATTERN.test(folder)) {
    throw new Error(
      `Invalid storage folder name: "${folder}". Use only letters, numbers, hyphens and underscores.`,
    );
  }

  return folder;
};

export const getFileExtension = (fileName: string): string => {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return "";
  }

  return fileName.slice(lastDot).toLowerCase();
};

/**
 * Collision-free stored file name: a random UUID keeps the original extension
 * but discards the user-provided name, so no lookups or races are needed. Pass
 * `extension` (including the leading dot) to override the extension, e.g. when
 * an image has been converted to a different format.
 */
export const generateStorageFileName = (
  originalName: string,
  extension?: string,
): string => {
  return `${randomUUID()}${extension ?? getFileExtension(originalName)}`;
};

export const replaceFileExtension = (
  fileName: string,
  extension: string,
): string => {
  const current = getFileExtension(fileName);
  const base = current ? fileName.slice(0, -current.length) : fileName;

  return `${base}${extension}`;
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
