import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { and, asc, count, eq, ne, sql } from "drizzle-orm";

import type { ContentDatabase } from "@/content/server/service";

import { buildRoute } from "@/api/builders";
import { appendModerationAudit } from "@/api/lib/moderation/warnings/reasons";
import { errorSchema, json } from "@/api/modules/moderation/lib/schema";
import { core_moderation_warning_thresholds } from "@/database/warnings";
import {
  WARNING_LIMITS,
  WARNING_THRESHOLD_ACTIONS,
} from "@/lib/moderation/warnings";

const thresholdSchema = z.object({
  id: z.number(),
  points: z.number(),
  action: z.enum(WARNING_THRESHOLD_ACTIONS),
  durationHours: z.number().nullable(),
  enabled: z.boolean(),
  updatedAt: z.date(),
});

const thresholdFields = z.object({
  points: z.number().int().min(1).max(WARNING_LIMITS.maxThresholdPoints),
  action: z.enum(WARNING_THRESHOLD_ACTIONS),
  durationHours: z
    .number()
    .int()
    .min(1)
    .max(WARNING_LIMITS.maxDurationHours)
    .nullable(),
  enabled: z.boolean(),
});

/** A temporary suspension needs its length; an indefinite one has none. */
const thresholdBody = thresholdFields.refine(
  value =>
    value.action === "suspend_temporary"
      ? value.durationHours !== null
      : value.durationHours === null,
  { message: "duration_mismatch", path: ["durationHours"] },
);

const idParams = z.object({
  id: z.coerce.number().int().positive().openapi({ example: 1 }),
});

const LOCK_THRESHOLDS = sql`lock table ${core_moderation_warning_thresholds} in share row exclusive mode`;

/** Whether another enabled rule already sits at `points`; rejected as ambiguous. */
const pointsTaken = async (
  tx: ContentDatabase,
  points: number,
  exceptId?: number,
): Promise<boolean> => {
  const table = core_moderation_warning_thresholds;
  const [row] = await tx
    .select({ id: table.id })
    .from(table)
    .where(
      and(
        eq(table.points, points),
        eq(table.enabled, true),
        exceptId === undefined ? undefined : ne(table.id, exceptId),
      ),
    )
    .limit(1);

  return row !== undefined;
};

const actorOf = (c: Context) => c.get("admin")?.user.id ?? null;

const responses = {
  400: json(errorSchema, "A temporary suspension needs a duration"),
  403: { description: "Access Denied" },
  409: json(
    errorSchema,
    "Another enabled threshold uses the same points, or the limit is reached",
  ),
};

export const listWarningThresholdsAdminRoute = buildRoute({
  adminStaffPermission: { module: "warning_settings", permission: "can_view" },
  route: {
    method: "get",
    path: "/thresholds",
    description: "Every warning threshold, lowest points first (Admin only)",
    responses: {
      200: json(
        z.object({ thresholds: z.array(thresholdSchema) }),
        "Warning thresholds",
      ),
      403: { description: "Access Denied" },
    },
  },
  handler: async c => {
    const table = core_moderation_warning_thresholds;
    const thresholds = await c
      .get("db")
      .select({
        action: table.action,
        durationHours: table.durationHours,
        enabled: table.enabled,
        id: table.id,
        points: table.points,
        updatedAt: table.updatedAt,
      })
      .from(table)
      .orderBy(asc(table.points), asc(table.id));

    return c.json({ thresholds }, 200);
  },
});

export const createWarningThresholdAdminRoute = buildRoute({
  adminStaffPermission: {
    module: "warning_settings",
    permission: "can_manage",
  },
  route: {
    method: "post",
    path: "/thresholds",
    description:
      "Add a threshold (Admin only). It applies to warnings issued from now on; members already above it are not suspended",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: thresholdBody } },
      },
    },
    responses: {
      201: json(z.object({ id: z.number() }), "Threshold created"),
      ...responses,
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    const table = core_moderation_warning_thresholds;
    const result = await c.get("db").transaction(async tx => {
      await tx.execute(LOCK_THRESHOLDS);
      const [{ total }] = await tx.select({ total: count() }).from(table);
      if (total >= WARNING_LIMITS.maxThresholds) {
        return { error: "limit_reached" } as const;
      }
      if (body.enabled && (await pointsTaken(tx, body.points))) {
        return { error: "duplicate_points" } as const;
      }

      const [row] = await tx
        .insert(table)
        .values(body)
        .returning({ id: table.id });
      await appendModerationAudit(tx, {
        actorId: actorOf(c),
        data: { thresholdId: row.id, ...body },
        type: "threshold_created",
      });

      return { id: row.id };
    });
    if ("error" in result) return c.json({ error: result.error }, 409);

    await c
      .get("events")
      .emit("moderation.warning_threshold.created", { thresholdId: result.id });

    return c.json({ id: result.id }, 201);
  },
});

export const updateWarningThresholdAdminRoute = buildRoute({
  adminStaffPermission: {
    module: "warning_settings",
    permission: "can_manage",
  },
  route: {
    method: "put",
    path: "/thresholds/{id}",
    description:
      "Edit, enable or disable a threshold (Admin only). Changes apply to future warnings only - nobody is suspended or unsuspended because of them",
    request: {
      params: idParams,
      body: {
        required: true,
        content: { "application/json": { schema: thresholdBody } },
      },
    },
    responses: {
      200: json(z.object({ id: z.number() }), "Threshold updated"),
      404: json(errorSchema, "Threshold not found"),
      ...responses,
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const table = core_moderation_warning_thresholds;
    const result = await c.get("db").transaction(async tx => {
      await tx.execute(LOCK_THRESHOLDS);
      const [existing] = await tx
        .select({ id: table.id })
        .from(table)
        .where(eq(table.id, id))
        .limit(1);
      if (!existing) return { error: "not_found" } as const;
      if (body.enabled && (await pointsTaken(tx, body.points, id))) {
        return { error: "duplicate_points" } as const;
      }

      await tx.update(table).set(body).where(eq(table.id, id));
      await appendModerationAudit(tx, {
        actorId: actorOf(c),
        data: { thresholdId: id, ...body },
        type: "threshold_updated",
      });

      return { id };
    });
    if ("error" in result) {
      return result.error === "not_found"
        ? c.json({ error: result.error }, 404)
        : c.json({ error: result.error }, 409);
    }

    await c
      .get("events")
      .emit("moderation.warning_threshold.updated", { thresholdId: id });

    return c.json({ id }, 200);
  },
});

export const deleteWarningThresholdAdminRoute = buildRoute({
  adminStaffPermission: {
    module: "warning_settings",
    permission: "can_manage",
  },
  route: {
    method: "delete",
    path: "/thresholds/{id}",
    description:
      "Delete a threshold (Admin only). Suspensions it created stay and keep a copy of the rule",
    request: { params: idParams },
    responses: {
      200: { description: "Threshold deleted" },
      403: { description: "Access Denied" },
      404: json(errorSchema, "Threshold not found"),
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const table = core_moderation_warning_thresholds;
    const deleted = await c.get("db").transaction(async tx => {
      const [row] = await tx
        .delete(table)
        .where(eq(table.id, id))
        .returning({ id: table.id, points: table.points });
      if (!row) return false;
      await appendModerationAudit(tx, {
        actorId: actorOf(c),
        data: { points: row.points, thresholdId: id },
        type: "threshold_deleted",
      });

      return true;
    });
    if (!deleted) return c.json({ error: "not_found" }, 404);

    await c
      .get("events")
      .emit("moderation.warning_threshold.deleted", { thresholdId: id });

    return c.body(null, 200);
  },
});
