import { z } from "@hono/zod-openapi";
import { inArray, sql } from "drizzle-orm";

import { buildRoute } from "@/builders";
import { core_reactions } from "@/database/reactions";
import { reactionCatalogChangedEvent } from "@/events/reactions";
import { writeAuditLog } from "@/lib/audit/write";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { forgetReactionCatalog } from "@/lib/reactions/catalog";
import { json } from "@/modules/reactions/reactions.schema";

import { errorSchema } from "../reactions.schema";

export const reorderReactionsAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.reactions.canManage,
  route: {
    method: "put",
    path: "/reorder",
    description:
      "Set the order of every reaction at once (Admin only). `ids` must list each reaction exactly once",
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
      400: json(errorSchema, "`ids` does not match the current reactions"),
      403: { description: "Access Denied" },
    },
  },
  handler: async c => {
    const { ids } = c.req.valid("json");
    const db = c.get("db");
    const current = await db
      .select({ id: core_reactions.id })
      .from(core_reactions);
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
          sql`when ${core_reactions.id} = ${id} then ${position}::integer`,
      ),
      sql` `,
    );
    await db.transaction(async tx => {
      await tx
        .update(core_reactions)
        .set({ position: sql`case ${positionById} end` })
        .where(inArray(core_reactions.id, ids));
      await writeAuditLog(
        c,
        {
          action: "reaction.reordered",
          metadata: { order: ids },
          target: { type: "reaction" },
        },
        tx,
      );
    });
    await forgetReactionCatalog(c);
    await c.get("events").emit(reactionCatalogChangedEvent, {
      action: "reordered",
      reactionId: null,
    });

    return c.body(null, 200);
  },
});
