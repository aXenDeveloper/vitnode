import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { and, eq, lte, notExists, sql } from "drizzle-orm";

import { contentDefinitionOf } from "@/content/server/model";
import {
  core_reactions_counts,
  core_reactions_entries,
} from "@/database/reactions";
import { buildCron } from "@/lib/cron";
import { recountReputation } from "@/lib/reactions/reputation";

/**
 * Removes reactions whose Content Engine record is gone - deleted by a
 * database cascade (a comment under a deleted article) that emitted no event -
 * recounts the reputation they gave, and drops count rows at zero. Custom
 * targets clean up with `deleteReactions` in their own delete path.
 */
export const reactionsCleanupCron = buildCron({
  name: "reactions-cleanup",
  description:
    "Remove reactions to deleted content, recount the reputation they gave, and drop empty count rows",
  schedule: "17 4 * * *",
  handler: async c => {
    const db = c.get("db");
    const models = c
      .get("core")
      .contentModels.filter(
        entry => contentDefinitionOf(entry.model).reactions.enabled,
      );

    const authors = new Set<number>();
    for (const { model, pluginId } of models) {
      const definition = contentDefinitionOf(model);
      const table: PgTable = model.table;
      const idColumn = (model.columns as Record<string, PgColumn>).id;
      const orphan = notExists(
        db
          .select({ one: sql`1` })
          .from(table)
          .where(sql`${idColumn}::text = ${core_reactions_entries.targetId}`),
      );

      const removed = await db
        .delete(core_reactions_entries)
        .where(
          and(
            eq(core_reactions_entries.pluginId, pluginId),
            eq(core_reactions_entries.targetType, definition.id),
            orphan,
          ),
        )
        .returning({ authorId: core_reactions_entries.targetAuthorId });
      for (const row of removed) {
        if (row.authorId !== null) authors.add(row.authorId);
      }

      await db.delete(core_reactions_counts).where(
        and(
          eq(core_reactions_counts.pluginId, pluginId),
          eq(core_reactions_counts.targetType, definition.id),
          notExists(
            db
              .select({ one: sql`1` })
              .from(table)
              .where(
                sql`${idColumn}::text = ${core_reactions_counts.targetId}`,
              ),
          ),
        ),
      );
    }

    await db
      .delete(core_reactions_counts)
      .where(lte(core_reactions_counts.count, 0));

    if (authors.size > 0) await recountReputation(c, [...authors]);
  },
});
