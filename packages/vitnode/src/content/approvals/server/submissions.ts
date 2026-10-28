import type { Context } from "hono";

import { and, desc, eq } from "drizzle-orm";

import type { ContentRecordContainer } from "../../containers/server/policy";
import type { ContentId } from "../../ids";
import type { AnyContentModel } from "../../server/model";
import type { ContentDatabase } from "../../server/service";
import type { AnyContentTypeDefinition } from "../../types";
import type { ContentSubmissionKind } from "../const";
import type { ContentApprovalState } from "../schema";

import { core_content_submissions } from "../../../database/content-submissions";
import { contentIdKey } from "../../ids";
import {
  recordContentApprovalResolved,
  recordContentApprovalSubmitted,
} from "../../server/notifications/intents";

export type { ContentApprovalState } from "../schema";

export type ContentSubmissionRow = typeof core_content_submissions.$inferSelect;

export const toContentApprovalState = (
  row: ContentSubmissionRow,
): ContentApprovalState => ({
  id: row.id,
  kind: row.kind,
  reason: row.status === "rejected" ? row.reason : null,
  status: row.status,
  submittedAt: row.createdAt,
  values: row.status === "pending" && row.kind === "edit" ? row.values : null,
});

export const findSubmissionModel = (
  c: Context,
  submission: Pick<ContentSubmissionRow, "contentTypeId" | "pluginId">,
): AnyContentModel | null =>
  (c.get("core")?.contentModels ?? []).find(
    entry =>
      entry.pluginId === submission.pluginId &&
      entry.model.definition.id === submission.contentTypeId,
  )?.model ?? null;

const itemCondition = (definition: AnyContentTypeDefinition, id: ContentId) =>
  and(
    eq(core_content_submissions.contentTypeId, definition.id),
    eq(core_content_submissions.itemId, contentIdKey(id)),
  );

export const findPendingContentSubmission = async (
  db: ContentDatabase,
  definition: AnyContentTypeDefinition,
  id: ContentId,
  { lock = false }: { lock?: boolean } = {},
): Promise<ContentSubmissionRow | null> => {
  const query = db
    .select()
    .from(core_content_submissions)
    .where(
      and(
        itemCondition(definition, id),
        eq(core_content_submissions.status, "pending"),
      ),
    )
    .limit(1);
  const [row] = lock ? await query.for("update") : await query;

  return row ?? null;
};

/** The newest submission of a record, whatever its status. */
export const findLatestContentSubmission = async (
  db: ContentDatabase,
  definition: AnyContentTypeDefinition,
  id: ContentId,
): Promise<ContentSubmissionRow | null> => {
  const [row] = await db
    .select()
    .from(core_content_submissions)
    .where(itemCondition(definition, id))
    .orderBy(
      desc(core_content_submissions.createdAt),
      desc(core_content_submissions.id),
    )
    .limit(1);

  return row ?? null;
};

export interface OpenContentSubmissionInput {
  authorId: number;
  baseUpdatedAt?: Date | null;
  baseValues?: null | Record<string, unknown>;
  baseVersion?: null | number;
  container: ContentRecordContainer | null;
  definition: AnyContentTypeDefinition;
  itemId: ContentId;
  kind: ContentSubmissionKind;
  pluginId: string;
  values: Record<string, unknown>;
}

/**
 * Opens a pending submission. A record has at most one: an older pending one
 * is marked `superseded` in the same transaction, and its id is returned so
 * the caller can say what was replaced.
 *
 * The moderators' notification intent is stored in the same transaction, so
 * it commits - or rolls back - with the submission.
 */
export const openContentSubmission = async (
  c: Context,
  tx: ContentDatabase,
  input: OpenContentSubmissionInput,
): Promise<{ replaced: null | number; row: ContentSubmissionRow }> => {
  const previous = await findPendingContentSubmission(
    tx,
    input.definition,
    input.itemId,
    { lock: true },
  );
  if (previous) {
    await tx
      .update(core_content_submissions)
      .set({ decidedAt: new Date(), status: "superseded" })
      .where(eq(core_content_submissions.id, previous.id));
    await recordContentApprovalResolved(c, tx, previous);
  }

  const [row] = await tx
    .insert(core_content_submissions)
    .values({
      authorId: input.authorId,
      baseUpdatedAt: input.baseUpdatedAt ?? null,
      baseValues: input.baseValues ?? null,
      baseVersion: input.baseVersion ?? null,
      containerDefinitionId: input.container?.definition.id ?? null,
      containerId: input.container?.container.id ?? null,
      contentTypeId: input.definition.id,
      itemId: contentIdKey(input.itemId),
      kind: input.kind,
      pluginId: input.pluginId,
      values: input.values,
    })
    .returning();
  await recordContentApprovalSubmitted(c, tx, row);

  return { replaced: previous?.id ?? null, row };
};

/** Keeps a pending create's snapshot in step with the draft it describes. */
export const refreshContentSubmissionValues = async (
  tx: ContentDatabase,
  id: number,
  values: Record<string, unknown>,
): Promise<void> => {
  await tx
    .update(core_content_submissions)
    .set({ values })
    .where(
      and(
        eq(core_content_submissions.id, id),
        eq(core_content_submissions.status, "pending"),
      ),
    );
};

/** Ends the pending submission of a record that no longer exists. */
export const cancelContentSubmissions = async (
  tx: ContentDatabase,
  definition: AnyContentTypeDefinition,
  id: ContentId,
): Promise<void> => {
  await tx
    .update(core_content_submissions)
    .set({ decidedAt: new Date(), status: "cancelled" })
    .where(
      and(
        itemCondition(definition, id),
        eq(core_content_submissions.status, "pending"),
      ),
    );
};

export const emitContentApprovalSubmitted = async (
  c: Context,
  { replaced, row }: { replaced: null | number; row: ContentSubmissionRow },
): Promise<void> => {
  await c.get("events").emit("content.approval.submitted", {
    authorId: row.authorId,
    containerId: row.containerId,
    contentId: row.itemId,
    contentTypeId: row.contentTypeId,
    kind: row.kind,
    pluginId: row.pluginId,
    replacedSubmissionId: replaced,
    submissionId: row.id,
  });
};
