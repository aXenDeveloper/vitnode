import { z } from "@hono/zod-openapi";
import { and, eq, ne } from "drizzle-orm";

import { buildRoute } from "@/builders";
import { core_reactions } from "@/database/reactions";
import { reactionCatalogChangedEvent } from "@/events/reactions";
import { auditDiff } from "@/lib/audit/diff";
import { multiLangAuditLabel } from "@/lib/audit/labels";
import { writeAuditLog } from "@/lib/audit/write";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { forgetReactionCatalog } from "@/lib/reactions/catalog";
import { authorsOfReaction } from "@/lib/reactions/reputation";
import { json } from "@/modules/reactions/reactions.schema";
import { queueReputationRecount } from "@/modules/reactions/tasks/recount-reputation.task";

import { deleteReactionFiles } from "../lib/image";
import { lookOf, replaceReactionRoles, saveReactionTitle } from "../lib/save";
import { errorSchema, idParams, reactionBody } from "../reactions.schema";

export const updateReactionAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.reactions.canManage,
  route: {
    method: "patch",
    path: "/{id}",
    description:
      "Edit a reaction (Admin only). New points apply to past reactions too: the reputation of everyone who received it is recounted in the background",
    request: {
      params: idParams,
      body: {
        required: true,
        content: { "application/json": { schema: reactionBody } },
      },
    },
    responses: {
      200: json(
        z.object({ id: z.number(), recounting: z.boolean() }),
        "Reaction updated",
      ),
      400: json(errorSchema, "The look does not match `kind` (`invalid_look`)"),
      403: { description: "Access Denied" },
      404: json(errorSchema, "Reaction not found"),
      409: json(errorSchema, "The code is taken (`code_taken`)"),
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const look = lookOf(body);
    if ("error" in look) return c.json({ error: look.error }, 400);

    const db = c.get("db");
    const [row] = await db
      .select()
      .from(core_reactions)
      .where(eq(core_reactions.id, id))
      .limit(1);
    if (!row) return c.json({ error: "not_found" }, 404);

    const [taken] = await db
      .select({ id: core_reactions.id })
      .from(core_reactions)
      .where(and(eq(core_reactions.code, body.code), ne(core_reactions.id, id)))
      .limit(1);
    if (taken) return c.json({ error: "code_taken" }, 409);

    const values = {
      ...look,
      allRoles: body.allRoles,
      code: body.code,
      enabled: body.enabled,
      kind: body.kind,
      points: body.points,
    };
    await db.transaction(async tx => {
      await tx
        .update(core_reactions)
        .set(values)
        .where(eq(core_reactions.id, id));
      await replaceReactionRoles(tx, id, body.roles);
      const changes = auditDiff({
        after: { ...values, title: multiLangAuditLabel(body.title) },
        before: {
          allRoles: row.allRoles,
          code: row.code,
          enabled: row.enabled,
          fileId: row.fileId,
          icon: row.icon,
          kind: row.kind,
          points: row.points,
          posterFileId: row.posterFileId,
        },
      });
      await writeAuditLog(
        c,
        {
          action: "reaction.updated",
          ...(changes ? { changes } : {}),
          metadata: { rolesChanged: true },
          target: {
            id,
            label: multiLangAuditLabel(body.title) ?? body.code,
            type: "reaction",
          },
        },
        tx,
      );
    });

    await saveReactionTitle(c, id, body.title);
    await forgetReactionCatalog(c);
    await deleteReactionFiles(
      c,
      [row.fileId, row.posterFileId].filter(
        fileId => fileId !== look.fileId && fileId !== look.posterFileId,
      ),
    );

    const recounting = row.points !== body.points;
    if (recounting) {
      await queueReputationRecount(c, await authorsOfReaction(c, id));
    }
    await c
      .get("events")
      .emit(reactionCatalogChangedEvent, { action: "updated", reactionId: id });

    return c.json({ id, recounting }, 200);
  },
});
