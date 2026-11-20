import { z } from "@hono/zod-openapi";
import { and, eq, sql } from "drizzle-orm";

import { buildRoute } from "@/builders";
import { core_languages_words } from "@/database/languages";
import { core_reactions, core_reactions_entries } from "@/database/reactions";
import { reactionCatalogChangedEvent } from "@/events/reactions";
import { writeAuditLog } from "@/lib/audit/write";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { forgetReactionCatalog } from "@/lib/reactions/catalog";
import { REACTION_WORDS } from "@/lib/reactions/const";
import { authorsOfReaction } from "@/lib/reactions/reputation";
import { json } from "@/modules/reactions/reactions.schema";
import { queueReputationRecount } from "@/modules/reactions/tasks/recount-reputation.task";

import { deleteReactionFiles } from "../lib/image";
import { errorSchema, idParams } from "../reactions.schema";

export const reactionDeleteImpactAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.reactions.canView,
  route: {
    method: "get",
    path: "/{id}/impact",
    description:
      "How many reactions and how much reputation deleting this reaction removes (Admin only)",
    request: { params: idParams },
    responses: {
      200: json(
        z.object({ reactions: z.number().int(), reputation: z.number().int() }),
        "What a delete would remove",
      ),
      403: { description: "Access Denied" },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const db = c.get("db");
    const [[row], [reaction]] = await Promise.all([
      db
        .select({
          reactions: sql<number>`count(*)::int`,
          withAuthor: sql<number>`count(${core_reactions_entries.targetAuthorId})::int`,
        })
        .from(core_reactions_entries)
        .where(eq(core_reactions_entries.reactionId, id)),
      db
        .select({ points: core_reactions.points })
        .from(core_reactions)
        .where(eq(core_reactions.id, id))
        .limit(1),
    ]);

    return c.json(
      {
        reactions: row.reactions,
        reputation: row.withAuthor * (reaction?.points ?? 0),
      },
      200,
    );
  },
});

export const deleteReactionAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.reactions.canManage,
  route: {
    method: "delete",
    path: "/{id}",
    description:
      "Delete a reaction with every time it was given (Admin only). The reputation it gave is taken back in the background",
    request: { params: idParams },
    responses: {
      200: { description: "Reaction deleted" },
      403: { description: "Access Denied" },
      404: json(errorSchema, "Reaction not found"),
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const db = c.get("db");
    const [row] = await db
      .select()
      .from(core_reactions)
      .where(eq(core_reactions.id, id))
      .limit(1);
    if (!row) return c.json({ error: "not_found" }, 404);

    const authors = await authorsOfReaction(c, id);
    await db.transaction(async tx => {
      await tx
        .delete(core_languages_words)
        .where(
          and(
            eq(core_languages_words.pluginCode, REACTION_WORDS.pluginCode),
            eq(core_languages_words.tableName, REACTION_WORDS.tableName),
            eq(core_languages_words.itemId, id),
          ),
        );
      await tx.delete(core_reactions).where(eq(core_reactions.id, id));
      await writeAuditLog(
        c,
        {
          action: "reaction.deleted",
          target: { id, label: row.code, type: "reaction" },
        },
        tx,
      );
    });

    await forgetReactionCatalog(c);
    await deleteReactionFiles(c, [row.fileId, row.posterFileId]);
    if (authors.length > 0) await queueReputationRecount(c, authors);
    await c
      .get("events")
      .emit(reactionCatalogChangedEvent, { action: "deleted", reactionId: id });

    return c.body(null, 200);
  },
});
