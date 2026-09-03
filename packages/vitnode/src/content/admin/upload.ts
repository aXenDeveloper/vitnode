import type { FileRejectionReason } from "../../lib/file-constraints";
import type { ContentFileDescriptor } from "../files";
import type { ContentFormSpec } from "./spec";

import { rawApiFetch } from "../../lib/fetcher/raw";
import { contentFileRejectionReason, zodContentFileDescriptor } from "../files";

export const contentUploadPath = (
  spec: Pick<ContentFormSpec, "permissionModule">,
  field: string,
): { module: string; path: string } => ({
  module: `content/${spec.permissionModule}`,
  path: `/uploads/${field}`,
});

/** A refused upload, as the route reports it. */
export interface ContentUploadRejection {
  code: string;
  message: string;
  /**
   * The rule that refused it, when the browser can say it better.
   *
   * Present only for the three codes the uploader can render itself from the
   * field's own limits, in the reader's own language. Absent for everything else
   * - a misconfigured adapter, a corrupt file, a permission problem - where the
   * server's own sentence is the most useful thing anybody has.
   */
  reason?: FileRejectionReason;
}

export class ContentUploadError extends Error {
  constructor({ code, message, reason }: ContentUploadRejection) {
    super(message);

    this.name = "ContentUploadError";
    this.code = code;
    this.reason = reason;
  }

  readonly code: string;
  readonly reason: FileRejectionReason | undefined;
}

/** Long enough for any message the API writes, short enough not to be a page. */
const MAX_MESSAGE_LENGTH = 400;

const clamp = (value: string): string =>
  value.length > MAX_MESSAGE_LENGTH
    ? `${value.slice(0, MAX_MESSAGE_LENGTH).trimEnd()}…`
    : value;

/**
 * What a status alone is worth saying, when the body said nothing usable.
 *
 * A last resort, and each one still names something actionable. `413` is the
 * important one: a body rejected by the platform - a proxy, a serverless
 * function's own limit - never reaches the route, so no `maxBytes` check ran and
 * there is no JSON to read. "Too large for this server" is the honest reading.
 */
const fromStatus = (status: number): string => {
  if (status === 413) {
    return "That file was rejected as too large before it reached the server. It may be over the hosting platform's own upload limit.";
  }
  if (status === 401) return "Your session has expired. Sign in again.";
  if (status === 403) {
    return "You do not have permission to upload here.";
  }
  if (status === 404) {
    return "This content type has no upload route. Rebuild the plugin and try again.";
  }
  if (status >= 500) {
    return `The server could not store the file (HTTP ${status}). Check the storage adapter configuration.`;
  }

  return `The upload was refused (HTTP ${status}).`;
};

/**
 * Reads whatever the route actually said.
 *
 * Three layers, in order, because a failing upload can answer in three shapes
 * and the *first* version of this only understood one of them:
 *
 * 1. **JSON `{ code, message }`** - what the generated route answers with.
 * 2. **Plain text** - what Hono renders an `HTTPException` message as, which is
 *    every guard outside the route's own body: rate limiting, CSRF, the admin
 *    session gate. Discarding it is what turned "Storage provider not found"
 *    into "please try again", and left an admin retrying a misconfiguration.
 * 3. **The status** - for an HTML error page from a proxy, or an empty body.
 *
 * `error` is read as well as `message`: the core error middleware answers with
 * `{ error }`, and a body that names the problem should be shown whichever key
 * it arrived under.
 */
const readRejection = async (
  response: Response,
): Promise<ContentUploadRejection> => {
  const raw = await response.text().catch(() => "");
  const fallback = { code: `HTTP_${response.status}` };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object") {
      const body = parsed as {
        code?: unknown;
        error?: unknown;
        message?: unknown;
      };
      const message =
        typeof body.message === "string" && body.message !== ""
          ? body.message
          : typeof body.error === "string" && body.error !== ""
            ? body.error
            : null;

      if (message !== null) {
        const code = typeof body.code === "string" ? body.code : fallback.code;

        return {
          code,
          message: clamp(message),
          ...(contentFileRejectionReason(code) === undefined
            ? {}
            : { reason: contentFileRejectionReason(code) }),
        };
      }
    }
  } catch {
    // Not JSON. The text branch below is the interesting one.
  }

  const text = raw.trim();
  // An HTML error page is a proxy talking, not the API - showing its markup
  // would be worse than saying nothing about it.
  if (text !== "" && !text.startsWith("<") && text.length < 2000) {
    return { ...fallback, message: clamp(text) };
  }

  return { ...fallback, message: fromStatus(response.status) };
};

/**
 * Uploads one file for one `file` field and returns its descriptor.
 *
 * **This is the only path binary data takes.** It is a `multipart/form-data`
 * `POST` from the browser to the generated API route, driven by TanStack Query -
 * not a Server Action. A Server Action body is a serialised RSC payload, so an
 * image would be encoded into a string, buffered whole in the Next.js process
 * and capped by a platform body limit that has nothing to do with the field's
 * `maxBytes`. The content mutation that follows is ordinary JSON carrying the
 * identifier this returns.
 *
 * A failure becomes a {@link ContentUploadError} carrying the reason the server
 * gave - never a generic sentence when the server wrote a specific one.
 */
export const uploadContentFile = async ({
  field,
  file,
  spec,
}: {
  field: string;
  file: File;
  spec: Pick<ContentFormSpec, "permissionModule" | "pluginId">;
}): Promise<ContentFileDescriptor> => {
  const formData = new FormData();
  formData.append("file", file);

  let response: Response;
  try {
    response = await rawApiFetch({
      ...contentUploadPath(spec, field),
      formData,
      method: "post",
      options: { credentials: "include" },
      pluginId: spec.pluginId,
      prefixPath: "/admin",
    });
  } catch (error) {
    // `rawApiFetch` throws rather than returning on a 500, and its message
    // carries the response body after a newline. The body is the part worth
    // reading - the URL in front of it is not something to show an editor.
    const detail =
      error instanceof Error ? error.message.split("\n").pop() : "";

    throw new ContentUploadError({
      code: "HTTP_500",
      message:
        detail !== undefined && detail.trim() !== ""
          ? clamp(detail.trim())
          : fromStatus(500),
    });
  }

  if (!response.ok) throw new ContentUploadError(await readRejection(response));

  // Parsed rather than cast: this value goes straight into the form, and the
  // descriptor is the one shape every surface agrees on.
  return zodContentFileDescriptor.parse(await response.json());
};
