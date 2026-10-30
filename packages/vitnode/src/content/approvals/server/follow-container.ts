import type { PgColumn } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq, inArray } from "drizzle-orm";

import type { ContentId } from "../../ids";
import type { AnyContentModel } from "../../server/model";
import type { AnyContentTypeDefinition } from "../../types";

import { core_content_submissions } from "../../../database/content-submissions";
import { contentContainerSourceOf } from "../../containers/association";
import { resolveContentRowContainer } from "../../containers/server/policy";
import { contentDefinitionOf } from "../../server/model";

/**
 * Keeps pending submissions filed where their record is now. A queue is
 * scoped to the moderators of a container, so a topic moved while it waits
 * for approval has to leave the old forum's queue and reach the new one's -
 * its replies included. Runs after the move committed; a failure is logged,
 * and deciding a submission re-checks the record's current container anyway.
 */
export const followContentSubmissionContainer = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  itemId: ContentId,
): Promise<void> => {
  const models = (
    (c.get("core")?.contentModels ?? []) as { model: AnyContentModel }[]
  ).map(entry => entry.model);
  const model = models.find(entry => entry.definition.id === definition.id);
  if (!model) return;

  const db = c.get("db");
  const columns = model.columns as Record<string, PgColumn>;
  const [row] = (await db
    .select()
    .from(model.table)
    .where(eq(columns.id, itemId))
    .limit(1)) as Record<string, unknown>[];
  if (!row) return;
  const container = await resolveContentRowContainer(c, db, definition, row);
  const containerId = container?.container.id ?? null;

  const pending = (contentTypeId: string, ids: readonly ContentId[]) =>
    and(
      eq(core_content_submissions.contentTypeId, contentTypeId),
      inArray(core_content_submissions.itemId, ids.map(String)),
      eq(core_content_submissions.status, "pending"),
    );

  await db
    .update(core_content_submissions)
    .set({ containerId })
    .where(pending(definition.id, [itemId]));

  // Records filed through this one (`field.relation({ container: true })`).
  for (const dependent of models) {
    const source = contentContainerSourceOf(contentDefinitionOf(dependent));
    if (source?.kind !== "relation" || source.target?.id !== definition.id) {
      continue;
    }
    const dependentColumns = dependent.columns as Record<string, PgColumn>;
    const column = dependentColumns[source.name];
    if (!column) continue;
    const rows = await db
      .select({ id: dependentColumns.id })
      .from(dependent.table)
      .where(eq(column, itemId));
    if (rows.length === 0) continue;
    await db
      .update(core_content_submissions)
      .set({ containerId })
      .where(
        pending(
          contentDefinitionOf(dependent).id,
          rows.map(entry => entry.id as ContentId),
        ),
      );
  }
};
