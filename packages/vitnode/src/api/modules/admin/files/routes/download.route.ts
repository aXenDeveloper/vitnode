import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_files } from "@/database/files";

export const downloadFileAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
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
      })
      .from(core_files)
      .where(eq(core_files.id, fileId))
      .limit(1);

    if (!file || !c.get("core").storage?.adapter) {
      return c.json({ error: "File not found" }, 404);
    }

    // Adapter-agnostic: fetch the stored object from its (server-reachable)
    // public URL and re-stream it as an attachment, so the browser saves it
    // with the original file name instead of opening it inline.
    const upstream = await fetch(c.get("storage").getUrl(file.key));
    if (!upstream.ok || !upstream.body) {
      return c.json({ error: "File not found" }, 404);
    }

    c.header("Content-Type", file.mimeType ?? "application/octet-stream");
    c.header(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    );
    const length = upstream.headers.get("content-length");
    if (length) {
      c.header("Content-Length", length);
    }

    return c.body(upstream.body, 200);
  },
});
