import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { createHash } from "node:crypto";

import { resolveClientIp } from "@/api/lib/client-ip";
import { CONFIG_PLUGIN } from "@/config";
import { CONTENT_ID_KEY_LENGTH } from "@/content/const";

import { buildRoute } from "../../../lib/route";

const SEARCH_POPULARITY_REPEAT_WINDOW_SECONDS = 30 * 60;

const viewerKey = (c: Context): string => {
  const user = c.get("user");
  if (user) return `user:${user.id}`;

  return `ip:${createHash("sha256").update(resolveClientIp(c)).digest("hex").slice(0, 32)}`;
};

export const popularityRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Counts a page view or a search click towards an item's popularity. Repeats from the same viewer within 30 minutes are ignored when Redis is configured.",
    path: "/popularity",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              itemId: z.string().trim().min(1).max(CONTENT_ID_KEY_LENGTH),
              itemType: z.string().trim().min(1).max(100),
              signal: z.enum(["click", "view"]),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ recorded: z.boolean() }),
          },
        },
        description: "Whether the signal counted",
      },
    },
  },
  handler: async c => {
    const { itemId, itemType, signal } = c.req.valid("json");

    const search = c.get("search");
    if (!(await search.isListed(itemType, itemId))) {
      return c.json({ recorded: false });
    }

    const isFirstInWindow = await c
      .get("cache")
      .acquireLock(
        `search-popularity:${signal}:${itemType}:${itemId}:${viewerKey(c)}`,
        SEARCH_POPULARITY_REPEAT_WINDOW_SECONDS,
      );
    if (!isFirstInWindow) return c.json({ recorded: false });

    await search.recordPopularity({ itemId, itemType, signal });

    return c.json({ recorded: true });
  },
});
