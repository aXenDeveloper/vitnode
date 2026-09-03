import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

export const zodClearSearchSchema = z.object({
  itemType: z.string().min(1),
});

export const clearSearchDebugAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "system", permission: "can_view" },
  route: {
    method: "post",
    description:
      "Permanently remove the currently indexed documents of one collection that has no registered rebuild indexer.",
    path: "/search/clear",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodClearSearchSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ cleared: z.boolean() }),
          },
        },
        description: "Collection cleared",
      },
      409: {
        description: "The collection has a registered rebuild indexer",
      },
    },
  },
  handler: async c => {
    const { itemType } = c.req.valid("json");

    if (c.get("core").searchIndexers.some(i => i.itemType === itemType)) {
      throw new HTTPException(409, {
        message: `"${itemType}" has a registered rebuild indexer. Rebuild it instead of deleting its documents.`,
      });
    }

    await c.get("search").clear(itemType);

    // The documents are already gone, so the audit trail is best effort: the
    // logger writes to the database and can fail on its own, and reporting a
    // failed cleanup for a cleanup that happened would send an administrator
    // looking for documents that are not there.
    const message = `[Search] Removed the indexed documents of unmanaged collection "${itemType}".`;
    try {
      await c.get("log").warn(message);
    } catch {
      // eslint-disable-next-line no-console
      console.warn(
        `[VitNode] Failed to persist search cleanup audit: ${message}`,
      );
    }

    return c.json({ cleared: true });
  },
});
