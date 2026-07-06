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
 * Guards the caller-provided folder against path traversal — only a single
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
 * but discards the user-provided name, so no lookups or races are needed.
 */
export const generateStorageFileName = (originalName: string): string => {
  return `${randomUUID()}${getFileExtension(originalName)}`;
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
