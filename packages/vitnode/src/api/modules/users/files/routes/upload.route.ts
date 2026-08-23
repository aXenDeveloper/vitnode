import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { StorageFileResult } from "@/api/models/storage";
import type { UploadRejection } from "@/lib/upload-limits";

import {
  resolveUploadLimits,
  resolveUploadRules,
} from "@/api/lib/resolve-upload-limits";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { validateUploadSelection } from "@/lib/upload-limits";

/**
 * Hono hands over a single `File` when the field appears once and an array when
 * it repeats, so both shapes are accepted and normalized here.
 */
const normalizeFiles = (value: File | File[]): File[] =>
  Array.isArray(value) ? value : [value];

const rejectionMessage = (rejection: UploadRejection): string => {
  switch (rejection.kind) {
    case "empty":
      return "No files provided";
    case "mime":
      return `Unsupported file type: ${rejection.fileName}`;
    case "not_allowed":
      return "Your role does not allow uploading files";
    case "quota":
      return `Not enough storage left: ${rejection.remainingBytes} bytes of ${rejection.limitBytes} available`;
    case "submit_limit":
      return `This upload is ${rejection.totalBytes} bytes, over the ${rejection.limitBytes} bytes allowed per submit`;
    case "too_many":
      return `Too many files - at most ${rejection.limit} per upload`;
  }
};

const zodUploadedFile = z.object({
  id: z.number(),
  name: z.string(),
  mimeType: z.string().nullable(),
  size: z.number(),
  url: z.string(),
});

export const uploadUserFilesRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Upload one or more files for the current user. Repeat the `files` field once per file. The role's upload permission and storage limits are enforced for the batch as a whole, so a rejected batch stores nothing.",
    path: "/",
    request: {
      body: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: z.object({
              files: z
                .union([z.instanceof(File), z.array(z.instanceof(File))])
                .openapi({
                  items: { format: "binary", type: "string" },
                  type: "array",
                }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              files: z.array(zodUploadedFile),
              usedBytes: z.number(),
            }),
          },
        },
        description: "Files uploaded",
      },
      400: {
        description: "Nothing to upload, an unsupported type, or over a limit",
      },
      401: {
        description: "Not signed in",
      },
      403: {
        description: "The user's roles do not allow uploading files",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    if (!c.get("core").storage?.adapter) {
      throw new HTTPException(400, {
        message: "Storage adapter not configured",
      });
    }

    // The quota is measured before the batch is stored, so two requests racing
    // each other can both pass and overshoot it by one batch. Worth knowing,
    // not worth a lock: the next request sees the real total and refuses.
    const files = normalizeFiles(c.req.valid("form").files);
    const rules = resolveUploadRules(c);
    const { usedBytes, ...limits } = await resolveUploadLimits(c, user);

    const rejection = validateUploadSelection({
      allowedMimeTypes: rules.allowedMimeTypes,
      files,
      limits,
      maxFiles: rules.maxFiles,
      usedBytes,
    });
    if (rejection) {
      throw new HTTPException(rejection.kind === "not_allowed" ? 403 : 400, {
        message: rejectionMessage(rejection),
      });
    }

    // All-or-nothing: a batch that fails halfway would leave the user with
    // files they never chose to keep and a quota they can't explain, so
    // whatever landed before the failure is removed again.
    const uploaded: StorageFileResult[] = [];
    try {
      for (const file of files) {
        uploaded.push(
          await c.get("storage").upload({
            file,
            folder: rules.folder,
            userId: user.id,
          }),
        );
      }
    } catch (error) {
      await Promise.all(
        uploaded.map(async file => {
          await c
            .get("storage")
            .deleteFile(file.id, user.id)
            .catch(() => undefined);
        }),
      );

      throw error;
    }

    for (const file of uploaded) {
      await c.get("events").emit("file.uploaded", {
        fileId: file.id,
        folder: rules.folder,
        mimeType: file.mimeType,
        name: file.name,
        size: file.size,
        userId: user.id,
      });
    }

    return c.json(
      {
        files: uploaded.map(({ id, mimeType, name, size, url }) => ({
          id,
          name,
          mimeType,
          size,
          url,
        })),
        usedBytes:
          usedBytes + uploaded.reduce((total, file) => total + file.size, 0),
      },
      200,
    );
  },
});
