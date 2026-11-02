import type { Context } from "hono";

import type { EnvVitNode } from "../middlewares/global.middleware";

/** What streaming a stored object back needs to know about it. */
export interface StoredFileForDownload {
  key: string;
  mimeType: null | string;
  name: string;
  /** Where the object lives. Defaults to `public`. */
  visibility?: "private" | "public";
}

/**
 * One stored object, re-streamed under its original name: as an attachment by
 * default, or `inline` for an image a page displays.
 *
 * Adapter-agnostic: a public object is fetched from its (server-reachable)
 * public URL, a private one from the adapter's private store - which is the
 * only way a private file ever leaves storage. Every response is
 * `private, no-store`, `nosniff` and sandboxed, so a file can never run as a
 * page of the site.
 *
 * `null` when the object could not be read at all, which each route answers
 * with its own 404. Who may download which file is decided before this is
 * ever called - the lookup and the authorization stay in the routes, and this
 * only knows how to send one.
 */
export const attachStoredFile = async (
  c: Context<EnvVitNode>,
  file: StoredFileForDownload,
  { inline = false }: { inline?: boolean } = {},
): Promise<null | Response> => {
  const object = await c
    .get("storage")
    .openFile({ key: file.key, visibility: file.visibility ?? "public" });
  if (!object) return null;

  const isImage = file.mimeType?.startsWith("image/") === true;
  c.header("Content-Type", file.mimeType ?? "application/octet-stream");
  // `filename*` with percent-encoding rather than a bare `filename`: a name can
  // carry a quote, a semicolon or anything non-ASCII, and any of those would
  // otherwise break the header or truncate the name.
  c.header(
    "Content-Disposition",
    `${inline && isImage ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
  );
  c.header("Cache-Control", "private, no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Content-Security-Policy", "sandbox; default-src 'none'");
  if (object.size !== undefined) {
    c.header("Content-Length", String(object.size));
  }

  return c.body(object.body, 200);
};
