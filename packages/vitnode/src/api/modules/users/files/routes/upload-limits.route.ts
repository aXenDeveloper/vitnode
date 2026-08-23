import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import {
  resolveUploadLimits,
  resolveUploadRules,
} from "@/api/lib/resolve-upload-limits";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { remainingUploadBytes } from "@/lib/upload-limits";

export const uploadLimitsUserFilesRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "What the current user may upload: the merged limits of their roles, the space they already use, and the rules of the upload endpoint. Lets a form refuse a file before spending an upload on it.",
    path: "/upload-limits",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              allowUpload: z.boolean(),
              allowedMimeTypes: z.array(z.string()),
              maxBytesPerSubmit: z.number().nullable(),
              maxFiles: z.number(),
              maxTotalBytes: z.number().nullable(),
              remainingBytes: z.number().nullable(),
              usedBytes: z.number(),
            }),
          },
        },
        description: "The current user's upload limits",
      },
      401: {
        description: "Not signed in",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const rules = resolveUploadRules(c);
    const { usedBytes, ...limits } = await resolveUploadLimits(c, user);
    // Without an adapter there is nowhere to put a file, whatever the roles say.
    const allowUpload = limits.allowUpload && !!c.get("core").storage?.adapter;

    return c.json(
      {
        ...limits,
        allowUpload,
        allowedMimeTypes: rules.allowedMimeTypes,
        maxFiles: rules.maxFiles,
        remainingBytes: remainingUploadBytes({ limits, usedBytes }),
        usedBytes,
      },
      200,
    );
  },
});
