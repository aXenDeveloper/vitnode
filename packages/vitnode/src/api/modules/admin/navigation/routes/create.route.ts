import { z } from "@hono/zod-openapi";
import { and, eq, sql } from "drizzle-orm";

import { findNavigationPreset } from "@/api/lib/navigation-presets";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_navigation } from "@/database/navigation";
import { isValidNavigationHref } from "@/lib/navigation";

import { expireNavigationCache } from "../lib/cache";
import {
  NAVIGATION_LOCATION_ERRORS,
  navigationCapacityProblem,
  navigationPlacementProblem,
} from "../lib/location";
import {
  checkNavigationParent,
  countNavigationRoots,
  nextNavigationPosition,
} from "../lib/position";
import {
  hasNavigationText,
  normalizeNavigationIcon,
  zodCreateNavigationSchema,
} from "../lib/schema";
import { saveNavigationWords } from "../lib/words";

const errorSchema = z.object({ error: z.string() });

export const NAVIGATION_ICON_ERROR =
  "An icon is a lucide icon, written as icon:compass";

export const NAVIGATION_PRESET_TAKEN_ERROR =
  "This prebuilt item is already in the menu";

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
      "Add a prebuilt page or a custom link to the header menu or the bottom bar (Admin only)",
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
        description: "Preset already in this menu, or the bottom bar is full",
      },
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    const db = c.get("db");
    const parentId = body.parentId ?? null;
    const location = body.location ?? "header";

    const icon = normalizeNavigationIcon(body.icon);
    if (!icon.ok) {
      return c.json({ error: NAVIGATION_ICON_ERROR }, 400);
    }

    let parentLocation: typeof location | undefined;
    if (parentId !== null) {
      const parent = await checkNavigationParent(c, parentId);
      if (parent.problem === "missing") {
        return c.json({ error: NAVIGATION_PARENT_ERRORS.missing }, 404);
      }
      if (parent.problem === "depth") {
        return c.json({ error: NAVIGATION_PARENT_ERRORS.depth }, 400);
      }
      parentLocation = parent.location;
    }

    const placementProblem = navigationPlacementProblem({
      location,
      parentId,
      parentLocation,
    });
    if (placementProblem) {
      return c.json(
        { error: NAVIGATION_LOCATION_ERRORS[placementProblem] },
        400,
      );
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

    const created = await db.transaction(
      async (tx): Promise<{ error: string } | { id: number }> => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`core_navigation:${location}`}))`,
        );

        const capacityProblem = navigationCapacityProblem({
          count: await countNavigationRoots(tx, location),
          location,
        });
        if (capacityProblem) {
          return { error: NAVIGATION_LOCATION_ERRORS[capacityProblem] };
        }

        if (body.kind === "preset") {
          const [existing] = await tx
            .select({ id: core_navigation.id })
            .from(core_navigation)
            .where(
              and(
                eq(core_navigation.kind, "preset"),
                eq(core_navigation.location, location),
                eq(core_navigation.pluginId, body.pluginId),
                eq(core_navigation.presetId, body.presetId),
              ),
            )
            .limit(1);
          if (existing) {
            return { error: NAVIGATION_PRESET_TAKEN_ERROR };
          }
        }

        const [inserted] = await tx
          .insert(core_navigation)
          .values({
            ...values,
            icon: icon.value,
            location,
            parentId,
            position: await nextNavigationPosition(tx, parentId, location),
            updatedAt: new Date(),
          })
          .returning({ id: core_navigation.id });

        return { id: inserted.id };
      },
    );

    if ("error" in created) {
      return c.json({ error: created.error }, 409);
    }

    await saveNavigationWords(c, created.id, {
      description: body.description,
      title: body.title,
    });

    await expireNavigationCache(c);
    await c.get("events").emit("navigation.created", {
      navigationId: created.id,
    });

    return c.json({ id: created.id }, 201);
  },
});
