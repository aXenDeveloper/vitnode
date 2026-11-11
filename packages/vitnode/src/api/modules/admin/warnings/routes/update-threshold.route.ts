import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { writeAuditLog } from "@/api/lib/audit/write";
import { errorSchema, json } from "@/api/modules/moderation/moderation.schema";
import { core_moderation_warning_thresholds } from "@/database/warnings";
import { auditDiff } from "@/lib/audit/diff";

import { LOCK_THRESHOLDS, pointsTaken, TARGET } from "../lib/threshold-rows";
import {
  idParams,
  responses,
  thresholdBody,
} from "../warning-thresholds.schema";

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
        .select({
          action: table.action,
          durationMinutes: table.durationMinutes,
          enabled: table.enabled,
          points: table.points,
        })
        .from(table)
        .where(eq(table.id, id))
        .limit(1);
      if (!existing) return { error: "not_found" } as const;
      if (body.enabled && (await pointsTaken(tx, body.points, id))) {
        return { error: "duplicate_points" } as const;
      }

      await tx.update(table).set(body).where(eq(table.id, id));
      await writeAuditLog(
        c,
        {
          action: "warning_threshold.updated",
          changes: auditDiff({ after: body, before: existing }),
          target: { id, label: String(body.points), type: TARGET },
        },
        tx,
      );

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
