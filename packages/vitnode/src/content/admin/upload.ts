import type { ContentFileDescriptor } from "../files";
import type { ContentFormSpec } from "./spec";

import { rawApiFetch } from "../../lib/fetcher/raw";
import { zodContentFileDescriptor } from "../files";

/**
 * The address of a content type's generated upload route.
 *
 * Built from the spec the form already has rather than from a route literal,
 * because the AdminCP content screen does not know at compile time which plugin
 * module it is talking to - the same reason `contentApiFetch` exists on the
 * server side.
 */
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
}

export class ContentUploadError extends Error {
  constructor({ code, message }: ContentUploadRejection) {
    super(message);

    this.name = "ContentUploadError";
    this.code = code;
  }

  readonly code: string;
}

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
 * A 4xx with a JSON body becomes a {@link ContentUploadError} whose message is
 * the one the server wrote - it names the field's own limits, so it is worth
 * showing verbatim.
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

  const response = await rawApiFetch({
    ...contentUploadPath(spec, field),
    formData,
    method: "post",
    options: { credentials: "include" },
    pluginId: spec.pluginId,
    prefixPath: "/admin",
  });

  if (!response.ok) {
    const rejection: unknown = await response.json().catch(() => null);
    const parsed =
      rejection !== null &&
      typeof rejection === "object" &&
      typeof (rejection as { message?: unknown }).message === "string"
        ? (rejection as ContentUploadRejection)
        : null;

    throw new ContentUploadError(
      parsed ?? {
        code: `HTTP_${response.status}`,
        message: "The upload failed. Please try again.",
      },
    );
  }

  // Parsed rather than cast: this value goes straight into the form, and the
  // descriptor is the one shape every surface agrees on.
  return zodContentFileDescriptor.parse(await response.json());
};
