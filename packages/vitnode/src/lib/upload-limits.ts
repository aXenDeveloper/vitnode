/**
 * Upload rules shared by the client and the API.
 *
 * The browser needs the same answers the route does - is this file type
 * allowed, does the batch fit in the quota - so the logic lives here and both
 * sides call it. The client uses it to reject a selection before spending an
 * upload; the route uses it as the real guard.
 */

/** Role limits are stored in kB; every other size in VitNode counts bytes. */
export const KILOBYTE = 1024;

/**
 * Default for the built-in user upload endpoint: raster images, PDF and plain
 * text. SVG is deliberately absent - it can carry script, and stored files are
 * served from the API origin - so allow it explicitly if you want it.
 */
export const DEFAULT_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
];

export const DEFAULT_UPLOAD_MAX_FILES = 10;

export const DEFAULT_UPLOAD_FOLDER = "uploads";

export interface RoleUploadSettings {
  allowUploadFiles: boolean;
  /** kB per submit, `null` for unlimited. */
  maxStorageForSubmit: null | number;
  /** kB in total, `null` for unlimited. */
  totalMaxStorage: null | number;
}

export interface UploadLimits {
  allowUpload: boolean;
  /** Bytes allowed in one submit, `null` for unlimited, `0` when uploads are off. */
  maxBytesPerSubmit: null | number;
  /** Bytes the user may store in total, `null` for unlimited, `0` when uploads are off. */
  maxTotalBytes: null | number;
}

export const NO_UPLOADS: UploadLimits = {
  allowUpload: false,
  maxBytesPerSubmit: 0,
  maxTotalBytes: 0,
};

export const UNLIMITED_UPLOADS: UploadLimits = {
  allowUpload: true,
  maxBytesPerSubmit: null,
  maxTotalBytes: null,
};

/**
 * The most permissive limit across the roles that allow uploading at all.
 *
 * A user holds a primary role plus any number of secondary ones, and a role
 * that forbids uploads is not a veto - it simply grants nothing, so it never
 * lowers a cap another role granted. `null` (unlimited) beats every number.
 */
export const mergeRoleUploadLimits = (
  roles: RoleUploadSettings[],
): UploadLimits => {
  const allowed = roles.filter(role => role.allowUploadFiles);
  if (allowed.length === 0) {
    return NO_UPLOADS;
  }

  const mostPermissive = (
    pick: (role: RoleUploadSettings) => null | number,
  ): null | number => {
    let best = 0;
    for (const role of allowed) {
      const value = pick(role);
      if (value === null) {
        return null;
      }
      best = Math.max(best, value);
    }

    return best * KILOBYTE;
  };

  return {
    allowUpload: true,
    maxBytesPerSubmit: mostPermissive(role => role.maxStorageForSubmit),
    maxTotalBytes: mostPermissive(role => role.totalMaxStorage),
  };
};

/** Bytes left in the user's quota, or `null` when the quota is unlimited. */
export const remainingUploadBytes = ({
  limits,
  usedBytes,
}: {
  limits: UploadLimits;
  usedBytes: number;
}): null | number =>
  limits.maxTotalBytes === null
    ? null
    : Math.max(0, limits.maxTotalBytes - usedBytes);

/** `image/png` against `["image/*"]` - a `*` on either half matches anything. */
export const isMimeTypeAllowed = (
  mimeType: string,
  allowedMimeTypes?: string[],
): boolean => {
  if (!allowedMimeTypes || allowedMimeTypes.length === 0) {
    return true;
  }

  const [type, subtype] = mimeType.toLowerCase().split("/");

  return allowedMimeTypes.some(allowed => {
    if (allowed === "*" || allowed === "*/*") return true;
    const [allowedType, allowedSubtype] = allowed.toLowerCase().split("/");

    return (
      allowedType === type &&
      (allowedSubtype === "*" || allowedSubtype === subtype)
    );
  });
};

export interface UploadCandidate {
  name: string;
  size: number;
  type: string;
}

export type UploadRejection =
  | { fileName: string; kind: "mime" }
  | { kind: "empty" }
  | { kind: "not_allowed" }
  | { kind: "quota"; limitBytes: number; remainingBytes: number }
  | { kind: "submit_limit"; limitBytes: number; totalBytes: number }
  | { kind: "too_many"; limit: number };

/**
 * First reason the selection can't be uploaded, or `null` when it can.
 *
 * One rejection rather than a list: the batch is refused whole, so the first
 * problem is the whole answer and the user fixes one thing at a time.
 */
export const validateUploadSelection = ({
  allowedMimeTypes,
  files,
  limits,
  maxFiles,
  usedBytes,
}: {
  allowedMimeTypes?: string[];
  files: UploadCandidate[];
  limits: UploadLimits;
  maxFiles?: number;
  usedBytes: number;
}): null | UploadRejection => {
  if (!limits.allowUpload) {
    return { kind: "not_allowed" };
  }
  if (files.length === 0) {
    return { kind: "empty" };
  }
  if (maxFiles !== undefined && files.length > maxFiles) {
    return { kind: "too_many", limit: maxFiles };
  }

  const rejected = files.find(
    file => !isMimeTypeAllowed(file.type, allowedMimeTypes),
  );
  if (rejected) {
    return { kind: "mime", fileName: rejected.name };
  }

  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (
    limits.maxBytesPerSubmit !== null &&
    totalBytes > limits.maxBytesPerSubmit
  ) {
    return {
      kind: "submit_limit",
      limitBytes: limits.maxBytesPerSubmit,
      totalBytes,
    };
  }

  const remaining = remainingUploadBytes({ limits, usedBytes });
  if (remaining !== null && totalBytes > remaining) {
    return {
      kind: "quota",
      limitBytes: limits.maxTotalBytes ?? 0,
      remainingBytes: remaining,
    };
  }

  return null;
};
