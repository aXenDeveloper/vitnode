import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_navigation } from "@/database/navigation";

import { expireNavigationCache } from "../lib/cache";
import { reorderNavigationTree } from "../lib/reorder";
import { zodReorderNavigationSchema } from "../lib/schema";

const REORDER_ERRORS = {
  duplicate: "An item appears twice in the new order",
  incomplete: "The new order has to name every menu item",
  unknown: "The new order names an item that does not exist",
} as const;

export const reorderNavigationAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "navigation", permission: "can_edit" },
  route: {
    method: "post",
    description:
      "Save the whole main menu as an ordered tree, one level deep (Admin only)",
    path: "/reorder",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodReorderNavigationSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: zodReorderNavigationSchema,
          },
        },
        description: "Navigation reordered",
      },
      400: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "The order does not cover the menu exactly once",
      },
      403: {
        description: "Access Denied",
      },
    },
  },
  handler: async c => {
    const { items } = c.req.valid("json");
    const db = c.get("db");

    const existing = await db
      .select({ id: core_navigation.id })
      .from(core_navigation);

    const outcome = reorderNavigationTree(
      items,
      existing.map(row => row.id),
    );
    if (!outcome.ok) {
      return c.json({ error: REORDER_ERRORS[outcome.reason] }, 400);
    }

    await db.transaction(async tx => {
      for (const placement of outcome.placements) {
        await tx
          .update(core_navigation)
          .set({
            parentId: placement.parentId,
            position: placement.position,
            updatedAt: new Date(),
          })
          .where(eq(core_navigation.id, placement.id));
      }
    });

    await expireNavigationCache(c);
    await c.get("events").emit("navigation.reordered", { items });

    return c.json({ items }, 200);
  },
});
