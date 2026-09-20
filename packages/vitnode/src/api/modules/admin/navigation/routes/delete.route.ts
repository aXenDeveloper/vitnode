import { z } from "@hono/zod-openapi";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_languages_words } from "@/database/languages";
import { core_navigation } from "@/database/navigation";
import { NAVIGATION_TABLE_NAME, NAVIGATION_WORDS } from "@/lib/navigation";

import { expireNavigationCache } from "../lib/cache";

export const deleteNavigationAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "navigation", permission: "can_delete" },
  route: {
    method: "delete",
    description:
      "Remove an item from the main menu; anything nested under it moves to the top level (Admin only)",
    path: "/{id}",
    request: {
      params: z.object({
        id: z.string().openapi({ example: "1" }),
      }),
    },
    responses: {
      200: {
        description: "Navigation item deleted",
      },
      403: {
        description: "Access Denied",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Navigation item not found",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const db = c.get("db");

    const itemId = Number(id);
    if (!Number.isInteger(itemId)) {
      return c.json({ error: "Navigation item not found" }, 404);
    }

    const [item] = await db
      .select({ id: core_navigation.id })
      .from(core_navigation)
      .where(eq(core_navigation.id, itemId))
      .limit(1);
    if (!item) {
      return c.json({ error: "Navigation item not found" }, 404);
    }

    await db.transaction(async tx => {
      const children = await tx
        .select({ id: core_navigation.id })
        .from(core_navigation)
        .where(eq(core_navigation.parentId, itemId))
        .orderBy(asc(core_navigation.position), asc(core_navigation.id));

      if (children.length > 0) {
        const [lastRoot] = await tx
          .select({ position: core_navigation.position })
          .from(core_navigation)
          .where(isNull(core_navigation.parentId))
          .orderBy(desc(core_navigation.position))
          .limit(1);
        let position = (lastRoot?.position ?? -1) + 1;

        for (const child of children) {
          await tx
            .update(core_navigation)
            .set({ parentId: null, position, updatedAt: new Date() })
            .where(eq(core_navigation.id, child.id));
          position += 1;
        }
      }

      await tx
        .delete(core_languages_words)
        .where(
          and(
            eq(core_languages_words.pluginCode, CONFIG_PLUGIN.pluginId),
            eq(core_languages_words.tableName, NAVIGATION_TABLE_NAME),
            inArray(core_languages_words.variable, [
              NAVIGATION_WORDS.title,
              NAVIGATION_WORDS.description,
            ]),
            eq(core_languages_words.itemId, itemId),
          ),
        );

      await tx.delete(core_navigation).where(eq(core_navigation.id, itemId));
    });

    await expireNavigationCache(c);
    await c.get("events").emit("navigation.deleted", { navigationId: itemId });

    return c.body(null, 200);
  },
});
