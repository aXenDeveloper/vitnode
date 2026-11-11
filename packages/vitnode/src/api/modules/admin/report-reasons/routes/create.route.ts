import { z } from "@hono/zod-openapi";
import { count, max } from "drizzle-orm";
import { randomBytes } from "node:crypto";

import { buildRoute } from "@/api/builders";
import { multiLangAuditLabel } from "@/api/lib/audit/labels";
import { writeAuditLog } from "@/api/lib/audit/write";
import { errorSchema, json } from "@/api/modules/moderation/moderation.schema";
import { core_moderation_report_reasons } from "@/database/moderation";
import { auditDiff } from "@/lib/audit/diff";
import { MODERATION_LIMITS } from "@/lib/moderation/const";

import { LOCK_REASONS } from "../lib/reason-rows";
import { saveReasonWords } from "../lib/reason-words";
import { reasonBody } from "../report-reasons.schema";

export const createReportReasonAdminRoute = buildRoute({
  adminStaffPermission: { module: "report_reasons", permission: "can_create" },
  route: {
    method: "post",
    path: "/create",
    description:
      "Add a report reason at the end of the list (Admin only). Members see it in the report dialog right away. There can be at most 10 reasons",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: reasonBody } },
      },
    },
    responses: {
      201: json(z.object({ id: z.number() }), "Report reason created"),
      403: { description: "Access Denied" },
      409: json(
        errorSchema,
        "The list already holds the maximum number of reasons",
      ),
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    const code = `reason_${randomBytes(6).toString("hex")}`;
    const created = await c.get("db").transaction(async tx => {
      await tx.execute(LOCK_REASONS);
      const [{ position: lastPosition, total }] = await tx
        .select({
          position: max(core_moderation_report_reasons.position),
          total: count(),
        })
        .from(core_moderation_report_reasons);
      if (total >= MODERATION_LIMITS.maxReportReasons) return null;

      const [row] = await tx
        .insert(core_moderation_report_reasons)
        .values({
          code,
          position: (lastPosition ?? -1) + 1,
          requiresDetails: body.requiresDetails,
        })
        .returning({ id: core_moderation_report_reasons.id });

      await writeAuditLog(
        c,
        {
          action: "report_reason.created",
          changes: auditDiff({
            after: {
              requiresDetails: body.requiresDetails,
              title: multiLangAuditLabel(body.title),
            },
            before: null,
          }),
          target: {
            id: row.id,
            label: multiLangAuditLabel(body.title),
            type: "report_reason",
          },
        },
        tx,
      );

      return row;
    });
    if (!created) return c.json({ error: "limit_reached" }, 409);

    await saveReasonWords(c, created.id, body);
    await c
      .get("events")
      .emit("moderation.report_reason.created", { code, reasonId: created.id });

    return c.json({ id: created.id }, 201);
  },
});
