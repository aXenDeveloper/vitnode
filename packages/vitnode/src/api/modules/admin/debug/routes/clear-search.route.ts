import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

export const zodClearSearchSchema = z.object({
  itemType: z.string().min(1),
});

/**
 * Deletes the documents of one collection that has no registered rebuild
 * indexer.
 *
 * Deliberately not part of `/search/rebuild`: this removes documents and puts
 * nothing back, so it must not hide behind an action called "reindex". It is
 * refused for a collection that *does* have an indexer - that one has a rebuild,
 * which is the non-destructive way to get the same freshness.
 *
 * What it does **not** mean is that the collection is abandoned. Registering an
 * indexer is optional, and a plugin that writes through `search.index()` keeps
 * its collection current without one - so a cleared collection can reappear on
 * that plugin's next write. This clears the current indexed state; it does not
 * stop anything from writing again.
 *
 * `itemType` is required and non-empty, so there is no payload that clears the
 * whole index by omission. A full rebuild is the only thing that does that, and
 * it refills what it can.
 */
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
