import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

export const deleteUserFileRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "delete",
    description: "Delete one of the current user's files.",
    path: "/{id}",
    request: {
      params: z.object({
        id: z.string().openapi({ example: "1" }),
      }),
      /** See the admin route: history can be forced past, live content cannot. */
      query: z.object({
        force: z.enum(["true", "false"]).optional(),
      }),
    },
    responses: {
      200: {
        description: "File deleted",
      },
      401: {
        description: "Not signed in",
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
            schema: z.object({
              code: z.string(),
              content: z.boolean(),
              id: z.number(),
              revisions: z.number(),
            }),
          },
        },
        description:
          "Still referenced by content or by a retained revision, so the file was kept",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const { id } = c.req.valid("param");
    const fileId = Number(id);
    if (!Number.isInteger(fileId)) {
      return c.json({ error: "File not found" }, 404);
    }

    await c.get("storage").deleteFile(fileId, {
      force: c.req.query("force") === "true",
      ownerId: user.id,
    });

    return c.body(null, 200);
  },
});
