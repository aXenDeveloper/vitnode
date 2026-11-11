import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { moderationWarningReasonUpdatedEvent } from "@/api/events/moderation";
import { multiLangAuditLabel } from "@/api/lib/audit/labels";
import { writeAuditLog } from "@/api/lib/audit/write";
import { listWarningReasons } from "@/api/lib/moderation/warnings/reasons";
import { errorSchema, json } from "@/api/modules/moderation/moderation.schema";
import { core_moderation_warning_reasons } from "@/database/warnings";
import { auditDiff } from "@/lib/audit/diff";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import { auditedSettings } from "../lib/reason-audit";
import { saveReasonWords } from "../lib/reason-words";
import { reasonBody } from "../warning-reasons.schema";

const idParams = z.object({
  id: z.coerce.number().int().positive().openapi({ example: 1 }),
});

export const updateWarningReasonAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.warning_settings.canManage,
  route: {
    method: "patch",
    path: "/reasons/{id}",
    description:
      "Edit or disable a warning reason (Admin only). Warnings already issued keep the points, expiry and title they were issued with",
    request: {
      params: idParams,
      body: {
        required: true,
        content: { "application/json": { schema: reasonBody.partial() } },
      },
    },
    responses: {
      200: json(z.object({ id: z.number() }), "Warning reason updated"),
      403: { description: "Access Denied" },
      404: json(errorSchema, "Warning reason not found"),
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const settings = auditedSettings(body);
    const patch = Object.fromEntries(
      Object.entries(settings).filter(([, value]) => value !== undefined),
    );

    const found = await c.get("db").transaction(async tx => {
      const [row] = await tx
        .select({
          enabled: core_moderation_warning_reasons.enabled,
          expiresAfterHours: core_moderation_warning_reasons.expiresAfterHours,
          id: core_moderation_warning_reasons.id,
          points: core_moderation_warning_reasons.points,
        })
        .from(core_moderation_warning_reasons)
        .where(eq(core_moderation_warning_reasons.id, id))
        .limit(1);
      if (!row) return false;
      if (Object.keys(patch).length > 0) {
        await tx
          .update(core_moderation_warning_reasons)
          .set(patch)
          .where(eq(core_moderation_warning_reasons.id, id));
      }
      const [stored] = await listWarningReasons(c, { id });
      const label = multiLangAuditLabel(body.title ?? stored?.title);
      await writeAuditLog(
        c,
        {
          action: "warning_reason.updated",
          changes: auditDiff({
            after: {
              ...row,
              ...patch,
              ...(body.title === undefined ? {} : { title: label }),
            },
            before: row,
            exclude: ["id"],
          }),
          metadata: {
            ...(body.description === undefined
              ? {}
              : { descriptionChanged: true }),
            ...(body.message === undefined ? {} : { messageChanged: true }),
          },
          target: { id, label, type: "warning_reason" },
        },
        tx,
      );

      return true;
    });
    if (!found) return c.json({ error: "not_found" }, 404);

    await saveReasonWords(c, id, body);
    await c
      .get("events")
      .emit(moderationWarningReasonUpdatedEvent, { reasonId: id });

    return c.json({ id }, 200);
  },
});
