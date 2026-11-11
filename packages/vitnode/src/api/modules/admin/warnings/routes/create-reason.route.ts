import { z } from "@hono/zod-openapi";
import { count, max, sql } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { moderationWarningReasonCreatedEvent } from "@/api/events/moderation";
import { multiLangAuditLabel } from "@/api/lib/audit/labels";
import { writeAuditLog } from "@/api/lib/audit/write";
import { errorSchema, json } from "@/api/modules/moderation/moderation.schema";
import { core_moderation_warning_reasons } from "@/database/warnings";
import { auditDiff } from "@/lib/audit/diff";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { WARNING_LIMITS } from "@/lib/moderation/warnings";

import { auditedSettings } from "../lib/reason-audit";
import { saveReasonWords } from "../lib/reason-words";
import { reasonBody } from "../warning-reasons.schema";

const LOCK_REASONS = sql`lock table ${core_moderation_warning_reasons} in share row exclusive mode`;

export const createWarningReasonAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.warning_settings.canManage,
  route: {
    method: "post",
    path: "/reasons",
    description: `Add a warning reason at the end of the list (Admin only). There can be at most ${WARNING_LIMITS.maxReasons}`,
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: reasonBody } },
      },
    },
    responses: {
      201: json(z.object({ id: z.number() }), "Warning reason created"),
      403: { description: "Access Denied" },
      409: json(errorSchema, "The list already holds the maximum number"),
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    const created = await c.get("db").transaction(async tx => {
      await tx.execute(LOCK_REASONS);
      const [{ position: lastPosition, total }] = await tx
        .select({
          position: max(core_moderation_warning_reasons.position),
          total: count(),
        })
        .from(core_moderation_warning_reasons);
      if (total >= WARNING_LIMITS.maxReasons) return null;

      const [row] = await tx
        .insert(core_moderation_warning_reasons)
        .values({
          enabled: body.enabled,
          expiresAfterHours: body.expiresAfterHours,
          points: body.points,
          position: (lastPosition ?? -1) + 1,
        })
        .returning({ id: core_moderation_warning_reasons.id });
      const label = multiLangAuditLabel(body.title);
      await writeAuditLog(
        c,
        {
          action: "warning_reason.created",
          changes: auditDiff({
            after: { ...auditedSettings(body), title: label },
            before: null,
          }),
          target: { id: row.id, label, type: "warning_reason" },
        },
        tx,
      );

      return row;
    });
    if (!created) return c.json({ error: "limit_reached" }, 409);

    await saveReasonWords(c, created.id, body);
    await c
      .get("events")
      .emit(moderationWarningReasonCreatedEvent, { reasonId: created.id });

    return c.json({ id: created.id }, 201);
  },
});
