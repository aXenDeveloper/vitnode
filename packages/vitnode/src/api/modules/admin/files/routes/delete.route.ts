import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

export const deleteFileAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "files", permission: "can_delete" },
  route: {
    method: "delete",
    description: "Delete an uploaded file and its record (Admin only).",
    path: "/{id}",
    request: {
      params: z.object({
        id: z.string().openapi({ example: "1" }),
      }),
    },
    responses: {
      200: {
        description: "File deleted",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "File not found",
      },
      409: {
        content: {
          "application/json": {
            schema: z.object({ code: z.string(), id: z.number() }),
          },
        },
        description:
          "Still referenced by content or by a retained revision, so the file was kept",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const fileId = Number(id);
    if (!Number.isInteger(fileId)) {
      return c.json({ error: "File not found" }, 404);
    }

    await c.get("storage").deleteFile(fileId);

    return c.body(null, 200);
  },
});
