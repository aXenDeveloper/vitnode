import { getFileExtension } from "./file-extension";
import { formatBytes } from "./format-bytes";

export interface FileConstraints {
  /** Lowercase, leading dot. Omitted, any extension is accepted. */
  allowedExtensions?: readonly string[];
  /** Lowercased media types. Omitted, any type is accepted. */
  allowedMimeTypes?: readonly string[];
  /** Largest accepted upload, in bytes. Never optional. */
  maxBytes: number;
}

export interface FileCandidate {
  mimeType: null | string | undefined;
  name: string;
  size: number;
}

export type FileRejectionReason = "extension" | "mimeType" | "size";

export interface FileRejection {
  /** English, written for the person who picked the file. */
  message: string;
  reason: FileRejectionReason;
  /** The offending value - the size, the media type or the extension. */
  value: string;
}

export const validateFile = (
  { allowedExtensions, allowedMimeTypes, maxBytes }: FileConstraints,
  file: FileCandidate,
): FileRejection | null => {
  if (file.size > maxBytes) {
    return {
      message: `This file is ${formatBytes(file.size)}. The maximum is ${formatBytes(maxBytes)}.`,
      reason: "size",
      value: formatBytes(file.size),
    };
  }

  if (allowedMimeTypes) {
    const mimeType = (file.mimeType ?? "").trim().toLowerCase();
    if (!allowedMimeTypes.includes(mimeType)) {
      const shown = mimeType === "" ? "unknown" : mimeType;

      return {
        message: `"${shown}" is not an accepted file type. Accepted: ${allowedMimeTypes.join(", ")}.`,
        reason: "mimeType",
        value: shown,
      };
    }
  }

  if (allowedExtensions) {
    const extension = getFileExtension(file.name);
    if (!allowedExtensions.includes(extension)) {
      const shown = extension === "" ? file.name : extension;

      return {
        message: `"${shown}" is not an accepted file extension. Accepted: ${allowedExtensions.join(", ")}.`,
        reason: "extension",
        value: shown,
      };
    }
  }

  return null;
};

/**
 * The formats a field accepts, as somebody would say them out loud.
 *
 * `JPG, PNG, WEBP` rather than `image/jpeg, image/png, image/webp`: the person
 * choosing a file recognises the first and has no use for the second. Extensions
 * win when the field declares them; otherwise the media subtypes stand in, which
 * is still a word (`PDF`, `GIF`) rather than a header value.
 *
 * Empty when the field constrains neither - the UI then says "any file type"
 * rather than inventing a list.
 */
export const fileFormatLabels = ({
  allowedExtensions,
  allowedMimeTypes,
}: FileConstraints): string[] => {
  if (allowedExtensions && allowedExtensions.length > 0) {
    return [
      ...new Set(
        allowedExtensions.map(extension =>
          extension.replace(/^\./, "").toUpperCase(),
        ),
      ),
    ];
  }

  if (allowedMimeTypes && allowedMimeTypes.length > 0) {
    return [
      ...new Set(
        allowedMimeTypes.map(mimeType =>
          (mimeType.split("/")[1] ?? mimeType).toUpperCase(),
        ),
      ),
    ];
  }

  return [];
};

/**
 * The native picker's `accept` filter: extensions and media types together.
 *
 * Both, because the two rules are independent - a picker that knew only one of
 * them would either hide files the field accepts or offer files it does not.
 * `accept` is **UX only**: it filters a dialog, it does not check anything, and
 * a drag-and-drop or a hand-written request bypasses it entirely.
 */
export const fileAcceptAttribute = ({
  allowedExtensions,
  allowedMimeTypes,
}: FileConstraints): string | undefined => {
  const values = [...(allowedExtensions ?? []), ...(allowedMimeTypes ?? [])];

  return values.length > 0 ? values.join(",") : undefined;
};
