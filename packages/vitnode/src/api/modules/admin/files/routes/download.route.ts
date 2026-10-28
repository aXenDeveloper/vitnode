import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { attachStoredFile } from "@/api/lib/file-download";
import { core_files } from "@/database/files";

export const downloadFileAdminRoute = buildRoute({
  adminStaffPermission: { module: "files", permission: "can_download" },
  route: {
    method: "get",
    description:
      "Download an uploaded file as an attachment with its original name (Admin only).",
    path: "/{id}/download",
    request: {
      params: z.object({
        id: z.string().openapi({ example: "1" }),
      }),
      query: z.object({
        /** `true` shows an image in the page instead of downloading it. */
        inline: z.enum(["true", "false"]).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/octet-stream": {
            schema: z.string().openapi({ format: "binary", type: "string" }),
          },
        },
        description: "File contents",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "File not found",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const fileId = Number(id);
    if (!Number.isInteger(fileId)) {
      return c.json({ error: "File not found" }, 404);
    }

    const [file] = await c
      .get("db")
      .select({
        name: core_files.name,
        key: core_files.key,
        mimeType: core_files.mimeType,
        visibility: core_files.visibility,
      })
      .from(core_files)
      .where(eq(core_files.id, fileId))
      .limit(1);

    if (!file || !c.get("core").storage?.adapter) {
      return c.json({ error: "File not found" }, 404);
    }

    return (
      (await attachStoredFile(c, file, {
        inline: c.req.valid("query").inline === "true",
      })) ?? c.json({ error: "File not found" }, 404)
    );
  },
});
