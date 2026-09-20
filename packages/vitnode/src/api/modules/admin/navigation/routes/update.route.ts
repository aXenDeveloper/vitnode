import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_navigation } from "@/database/navigation";
import { isValidNavigationHref } from "@/lib/navigation";

import { expireNavigationCache } from "../lib/cache";
import { checkNavigationParent, nextNavigationPosition } from "../lib/position";
import {
  hasNavigationText,
  normalizeNavigationIcon,
  zodUpdateNavigationSchema,
} from "../lib/schema";
import { saveNavigationWords } from "../lib/words";
import {
  NAVIGATION_ICON_ERROR,
  NAVIGATION_PARENT_ERRORS,
} from "./create.route";

const errorSchema = z.object({ error: z.string() });

export const updateNavigationAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "navigation", permission: "can_edit" },
  route: {
    method: "patch",
    description: "Edit a main menu item (Admin only)",
    path: "/{id}",
    request: {
      params: z.object({
        id: z.string().openapi({ example: "1" }),
      }),
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodUpdateNavigationSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ id: z.number() }),
          },
        },
        description: "Navigation item updated",
      },
      400: {
        content: { "application/json": { schema: errorSchema } },
        description: "Invalid change",
      },
      403: {
        description: "Access Denied",
      },
      404: {
        content: { "application/json": { schema: errorSchema } },
        description: "Navigation item or parent not found",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");

    const itemId = Number(id);
    if (!Number.isInteger(itemId)) {
      return c.json({ error: "Navigation item not found" }, 404);
    }

    const [item] = await db
      .select({
        id: core_navigation.id,
        kind: core_navigation.kind,
        parentId: core_navigation.parentId,
      })
      .from(core_navigation)
      .where(eq(core_navigation.id, itemId))
      .limit(1);
    if (!item) {
      return c.json({ error: "Navigation item not found" }, 404);
    }

    if (body.href !== undefined) {
      if (item.kind !== "custom") {
        return c.json(
          { error: "A prebuilt item keeps the URL its plugin declares" },
          400,
        );
      }
      if (!isValidNavigationHref(body.href)) {
        return c.json({ error: "The URL must start with / or https://" }, 400);
      }
    }

    if (
      item.kind === "custom" &&
      body.title !== undefined &&
      !hasNavigationText(body.title)
    ) {
      return c.json({ error: "A title is required" }, 400);
    }

    const values: Partial<typeof core_navigation.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.href !== undefined) values.href = body.href;
    if (body.isOpenInNewTab !== undefined) {
      values.isOpenInNewTab = body.isOpenInNewTab;
    }
    if (body.icon !== undefined) {
      const icon = normalizeNavigationIcon(body.icon);
      if (!icon.ok) {
        return c.json({ error: NAVIGATION_ICON_ERROR }, 400);
      }
      values.icon = icon.value;
    }

    if (body.parentId !== undefined && body.parentId !== item.parentId) {
      if (body.parentId === itemId) {
        return c.json({ error: "A menu item cannot be its own parent" }, 400);
      }

      if (body.parentId !== null) {
        const problem = await checkNavigationParent(c, body.parentId);
        if (problem === "missing") {
          return c.json({ error: NAVIGATION_PARENT_ERRORS.missing }, 404);
        }
        if (problem === "depth") {
          return c.json({ error: NAVIGATION_PARENT_ERRORS.depth }, 400);
        }

        const [child] = await db
          .select({ id: core_navigation.id })
          .from(core_navigation)
          .where(eq(core_navigation.parentId, itemId))
          .limit(1);
        if (child) {
          return c.json(
            { error: "An item with nested items cannot be nested itself" },
            400,
          );
        }
      }

      values.parentId = body.parentId;
      values.position = await nextNavigationPosition(c, body.parentId);
    }

    await db
      .update(core_navigation)
      .set(values)
      .where(eq(core_navigation.id, itemId));

    await saveNavigationWords(c, itemId, {
      description: body.description,
      title: body.title,
    });

    await expireNavigationCache(c);
    await c.get("events").emit("navigation.updated", { navigationId: itemId });

    return c.json({ id: itemId }, 200);
  },
});
