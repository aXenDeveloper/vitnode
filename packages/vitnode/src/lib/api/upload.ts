import { getMonth, getYear } from "date-fns";
import { randomUUID } from "node:crypto";

import { getFileExtension, replaceFileExtension } from "../file-extension";

/**
 * Re-exported rather than defined here: `AutoFormFile` runs the same extension
 * check in the browser, and this module cannot cross that boundary - it imports
 * `node:crypto` at the top level.
 */
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

/**
 * The extensions each media type is allowed to be stored under.
 *
 * Only the types VitNode itself accepts are listed. Anything absent falls
 * through to {@link ACTIVE_CONTENT_EXTENSIONS} below, which is the conservative
 * half of the same rule.
 */
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

/**
 * Extensions a browser runs, rather than displays, when it fetches them from the
 * origin that stored them.
 *
 * Uploads are served from the site's own origin, so a stored `.html` is not an
 * attachment - it is a page on the site, with the site's cookies and the site's
 * API in reach.
 */
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

/** What an extension becomes when it cannot be kept. Nothing executes it. */
const NEUTRAL_EXTENSION = ".bin";

/** `.png`, but not `.tar.gz`, `..`, `.p h p` or a 300-character one. */
const WELL_FORMED_EXTENSION = /^\.[a-z0-9]{1,16}$/;

/**
 * The extension a file may actually be *stored* under.
 *
 * Both halves of an upload arrive from the client: the browser sends the media
 * type in the multipart part, and the file name next to it. Nothing made them
 * agree. Taking the extension straight off the name - which is what this used to
 * do - meant a file announced as `image/gif`, and accepted as one, could be
 * written to disk as `payload.html`; served back from the site's own origin it
 * is a page, not a picture, and script in it runs with the reader's session.
 *
 * So the media type decides. When it is one VitNode knows, the extension has to
 * be one of that type's own, and is replaced by its canonical one when it is
 * not. When the type is unknown there is nothing to check against, and the rule
 * narrows to the thing that actually causes harm: an extension the browser would
 * execute is replaced by {@link NEUTRAL_EXTENSION}.
 *
 * `.svg` is deliberately still storable - it is an image type a CMS has every
 * reason to accept - and an SVG can carry script. Neutralising it is the serving
 * layer's job, via the `Content-Security-Policy: sandbox` and `nosniff` headers
 * on the uploads mount, because those cover HTML that gets stored some other way
 * too.
 */
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

/**
 * Collision-free stored file name: a random UUID keeps the original extension
 * but discards the user-provided name, so no lookups or races are needed. Pass
 * `extension` (including the leading dot) to override the extension, e.g. when
 * an image has been converted to a different format.
 *
 * The extension that comes out is always one {@link safeStorageExtension} allows
 * for `mimeType`, whichever of the two it started from - the caller-supplied
 * override is server-derived and passes unchanged, and the one read off
 * `originalName` is the client's and is checked.
 */
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
