import { z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";

import { findNavigationPreset } from "@/api/lib/navigation-presets";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_navigation } from "@/database/navigation";
import { isValidNavigationHref } from "@/lib/navigation";

import { expireNavigationCache } from "../lib/cache";
import { checkNavigationParent, nextNavigationPosition } from "../lib/position";
import {
  hasNavigationText,
  normalizeNavigationIcon,
  zodCreateNavigationSchema,
} from "../lib/schema";
import { saveNavigationWords } from "../lib/words";

const errorSchema = z.object({ error: z.string() });

export const NAVIGATION_ICON_ERROR =
  "An icon is a lucide icon, written as icon:compass";

export const NAVIGATION_PARENT_ERRORS = {
  depth: "A menu item can only be nested one level deep",
  missing: "Parent menu item not found",
} as const;

export const createNavigationAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "navigation", permission: "can_create" },
  route: {
    method: "post",
    description:
      "Add a prebuilt page or a custom link to the main menu (Admin only)",
    path: "/create",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodCreateNavigationSchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: z.object({ id: z.number() }),
          },
        },
        description: "Navigation item created",
      },
      400: {
        content: { "application/json": { schema: errorSchema } },
        description: "Invalid item",
      },
      403: {
        description: "Access Denied",
      },
      404: {
        content: { "application/json": { schema: errorSchema } },
        description: "Preset or parent not found",
      },
      409: {
        content: { "application/json": { schema: errorSchema } },
        description: "Preset already in the menu",
      },
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    const db = c.get("db");
    const parentId = body.parentId ?? null;

    const icon = normalizeNavigationIcon(body.icon);
    if (!icon.ok) {
      return c.json({ error: NAVIGATION_ICON_ERROR }, 400);
    }

    if (parentId !== null) {
      const problem = await checkNavigationParent(c, parentId);
      if (problem === "missing") {
        return c.json({ error: NAVIGATION_PARENT_ERRORS.missing }, 404);
      }
      if (problem === "depth") {
        return c.json({ error: NAVIGATION_PARENT_ERRORS.depth }, 400);
      }
    }

    let values: Pick<
      typeof core_navigation.$inferInsert,
      "href" | "isOpenInNewTab" | "kind" | "pluginId" | "presetId"
    >;

    if (body.kind === "preset") {
      const preset = findNavigationPreset(
        c.get("core").navigation,
        body.pluginId,
        body.presetId,
      );
      if (!preset) {
        return c.json({ error: "Navigation preset not found" }, 404);
      }

      const [existing] = await db
        .select({ id: core_navigation.id })
        .from(core_navigation)
        .where(
          and(
            eq(core_navigation.kind, "preset"),
            eq(core_navigation.pluginId, body.pluginId),
            eq(core_navigation.presetId, body.presetId),
          ),
        )
        .limit(1);
      if (existing) {
        return c.json(
          { error: "This prebuilt item is already in the menu" },
          409,
        );
      }

      values = {
        href: null,
        isOpenInNewTab: body.isOpenInNewTab ?? preset.isOpenInNewTab,
        kind: "preset",
        pluginId: body.pluginId,
        presetId: body.presetId,
      };
    } else {
      if (!isValidNavigationHref(body.href)) {
        return c.json({ error: "The URL must start with / or https://" }, 400);
      }
      if (!hasNavigationText(body.title)) {
        return c.json({ error: "A title is required" }, 400);
      }

      values = {
        href: body.href,
        isOpenInNewTab: body.isOpenInNewTab ?? false,
        kind: "custom",
        pluginId: null,
        presetId: null,
      };
    }

    const [item] = await db
      .insert(core_navigation)
      .values({
        ...values,
        icon: icon.value,
        parentId,
        position: await nextNavigationPosition(c, parentId),
        updatedAt: new Date(),
      })
      .returning({ id: core_navigation.id });

    await saveNavigationWords(c, item.id, {
      description: body.description,
      title: body.title,
    });

    await expireNavigationCache(c);
    await c.get("events").emit("navigation.created", { navigationId: item.id });

    return c.json({ id: item.id }, 201);
  },
});
