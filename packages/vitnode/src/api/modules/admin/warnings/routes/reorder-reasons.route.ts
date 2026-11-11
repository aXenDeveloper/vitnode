import { z } from "@hono/zod-openapi";
import { inArray, sql } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { writeAuditLog } from "@/api/lib/audit/write";
import { errorSchema, json } from "@/api/modules/moderation/moderation.schema";
import { core_moderation_warning_reasons } from "@/database/warnings";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

export const reorderWarningReasonsAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.warning_settings.canManage,
  route: {
    method: "put",
    path: "/reasons/reorder",
    description:
      "Set the order of every warning reason at once (Admin only). `ids` must list each reason exactly once",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({ ids: z.array(z.number().int()).min(1) }),
          },
        },
      },
    },
    responses: {
      200: { description: "Order saved" },
      400: json(errorSchema, "`ids` does not match the current reasons"),
      403: { description: "Access Denied" },
    },
  },
  handler: async c => {
    const { ids } = c.req.valid("json");
    const db = c.get("db");
    const current = await db
      .select({ id: core_moderation_warning_reasons.id })
      .from(core_moderation_warning_reasons);
    const known = new Set(current.map(row => row.id));
    if (
      ids.length !== known.size ||
      new Set(ids).size !== ids.length ||
      ids.some(id => !known.has(id))
    ) {
      return c.json({ error: "mismatch" }, 400);
    }

    const positionById = sql.join(
      ids.map(
        (id, position) =>
          sql`when ${core_moderation_warning_reasons.id} = ${id} then ${position}::integer`,
      ),
      sql` `,
    );
    await db.transaction(async tx => {
      await tx
        .update(core_moderation_warning_reasons)
        .set({ position: sql`case ${positionById} end` })
        .where(inArray(core_moderation_warning_reasons.id, ids));
      await writeAuditLog(
        c,
        {
          action: "warning_reason.reordered",
          metadata: { order: ids },
          target: { type: "warning_reason" },
        },
        tx,
      );
    });

    return c.body(null, 200);
  },
});
