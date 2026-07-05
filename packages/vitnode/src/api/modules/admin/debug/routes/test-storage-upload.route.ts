import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

const ADMIN_TEST_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ADMIN_TEST_MIME_TYPES = [
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const testStorageUploadDebugAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "system", permission: "can_test_storage" },
  route: {
    method: "post",
    description:
      "Upload a test image to verify the storage adapter end-to-end from the admin panel.",
    path: "/test-storage-upload",
    request: {
      body: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: z.object({
              file: z
                .instanceof(File)
                .openapi({ format: "binary", type: "string" }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ key: z.string(), url: z.string() }),
          },
        },
        description: "Image uploaded",
      },
      400: {
        description: "Storage adapter not configured or invalid file",
      },
    },
  },
  handler: async c => {
    if (!c.get("core").storage?.adapter) {
      throw new HTTPException(400, {
        message: "Storage adapter not configured",
      });
    }

    const { file } = c.req.valid("form");

    const { key, url } = await c.get("storage").upload({
      file,
      folder: "admin-storage-test",
      maxBytes: ADMIN_TEST_MAX_BYTES,
      allowedMimeTypes: ADMIN_TEST_MIME_TYPES,
    });

    return c.json({ key, url }, 200);
  },
});
