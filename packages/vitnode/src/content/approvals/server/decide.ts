import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { eq } from "drizzle-orm";

import type { ContentId } from "../../ids";
import type { ContentActor } from "../../revisions";
import type { ContentEditorialOutcome } from "../../server/editorial-service";
import type { AnyContentModel } from "../../server/model";
import type { ContentDatabase } from "../../server/service";
import type { AnyContentTypeDefinition } from "../../types";
import type { ContentSubmissionDecisionCode } from "../const";
import type { ContentSubmissionRow } from "./submissions";

import { core_content_submissions } from "../../../database/content-submissions";
import { CONTENT_PERMISSIONS } from "../../const";
import { contentContainerSourceOf } from "../../containers/association";
import {
  canModerateContent,
  resolveContentRowContainer,
} from "../../containers/server/policy";
import { ContentInputError, ContentVersionConflict } from "../../errors";
import { parseContentId } from "../../ids";
import { contentDefinitionOf } from "../../server/model";
import { recordContentModerationDecision } from "../../server/notifications/intents";
import { publicationMethods } from "../../server/publication";
import {
  contentEditorialWriteEffects,
  contentPlainWriteEffects,
} from "../../server/write-effects";

const STATUS: Record<ContentSubmissionDecisionCode, 403 | 404 | 409> = {
  decided: 409,
  forbidden: 403,
  gone: 409,
  notFound: 404,
  stale: 409,
};

export class ContentSubmissionDecisionError extends Error {
  constructor(code: ContentSubmissionDecisionCode, message?: string) {
    super(message ?? `The submission cannot be decided: ${code}.`);
    this.name = "ContentSubmissionDecisionError";
    this.code = code;
    this.status = STATUS[code];
  }

  readonly code: ContentSubmissionDecisionCode;
  readonly status: 403 | 404 | 409;
}

export const findSubmissionModel = (
  c: Context,
  submission: Pick<ContentSubmissionRow, "contentTypeId" | "pluginId">,
): AnyContentModel | null =>
  (c.get("core")?.contentModels ?? []).find(
    entry =>
      entry.pluginId === submission.pluginId &&
      entry.model.definition.id === submission.contentTypeId,
  )?.model ?? null;

const lockRecord = async (
  tx: ContentDatabase,
  model: AnyContentModel,
  id: ContentId,
): Promise<null | Record<string, unknown>> => {
  const definition = contentDefinitionOf(model);
  const columns = model.columns as Record<string, PgColumn>;
  const table: PgTable = model.table;
  const source = contentContainerSourceOf(definition);
  const [row] = await tx
    .select({
      id: columns.id,
      publishedAt: columns.publishedAt,
      status: columns.status,
      updatedAt: columns.updatedAt,
      ...(definition.editorial.enabled ? { version: columns.version } : {}),
      ...(source && columns[source.name]
        ? { [source.name]: columns[source.name] }
        : {}),
    })
    .from(table)
    .where(eq(columns.id, id))
    .limit(1)
    .for("update");

  return row ?? null;
};

type Applied =
  | {
      changedFields: string[];
      kind: "plain";
      operation: "publish" | "update";
      row: Record<string, unknown>;
    }
  | {
      kind: "editorial";
      outcome: ContentEditorialOutcome<AnyContentTypeDefinition> | null;
    }
  | { kind: "none" };

const applyApproval = async (
  c: Context,
  tx: ContentDatabase,
  {
    actor,
    id,
    model,
    pluginId,
    row,
    submission,
  }: {
    actor: ContentActor;
    id: ContentId;
    model: AnyContentModel;
    pluginId: string;
    row: Record<string, unknown>;
    submission: ContentSubmissionRow;
  },
): Promise<Applied> => {
  const definition = contentDefinitionOf(model);
  const editorial = definition.editorial.enabled;

  if (submission.kind === "create") {
    if (row.status === "published") return { kind: "none" };

    if (editorial) {
      const service = model.editorialService?.(c, { pluginId });

      return {
        kind: "editorial",
        outcome: (await service?.publish(id, { actor, tx })) ?? null,
      };
    }

    const published = await publicationMethods(
      definition,
      model.service(c),
    ).publish(id, { tx });

    return published
      ? {
          changedFields: [],
          kind: "plain",
          operation: "publish",
          row: published.row,
        }
      : { kind: "none" };
  }

  try {
    if (editorial) {
      if (row.version !== submission.baseVersion) {
        throw new ContentSubmissionDecisionError("stale");
      }
      const service = model.editorialService?.(c, { pluginId });

      return {
        kind: "editorial",
        outcome:
          (await service?.update(id, submission.values, {
            actor,
            expectedVersion: submission.baseVersion ?? 0,
            tx,
          })) ?? null,
      };
    }

    const base = submission.baseUpdatedAt?.getTime();
    if (
      base !== undefined &&
      (row.updatedAt as Date | undefined)?.getTime() !== base
    ) {
      throw new ContentSubmissionDecisionError("stale");
    }
    const updated = await model
      .service(c)
      .update(id, submission.values, { tx });

    return updated
      ? {
          changedFields: updated.changedFields,
          kind: "plain",
          operation: "update",
          row: updated.row,
        }
      : { kind: "none" };
  } catch (error) {
    if (error instanceof ContentVersionConflict) {
      throw new ContentSubmissionDecisionError("stale");
    }
    if (error instanceof ContentInputError) {
      throw new ContentSubmissionDecisionError("stale", error.message);
    }
    throw error;
  }
};

export interface ContentSubmissionDecision {
  decision: "approve" | "reject";
  id: number;
  reason?: null | string;
  reviewerId: number;
}

/**
 * Approves or rejects one submission.
 *
 * The submission row is locked first and must still be `pending`, so two
 * moderators deciding at once get one success and one `decided`. The record is
 * locked next, its container is resolved again from the row - wherever it
 * lives now - and `can_approve` is checked against that container. Approving a
 * create publishes the draft; approving an edit applies the proposal against
 * the version it was made from, and answers `stale` if the record moved since.
 */
export const decideContentSubmission = async (
  c: Context,
  { decision, id, reason = null, reviewerId }: ContentSubmissionDecision,
): Promise<ContentSubmissionRow> => {
  const actor: ContentActor = { type: "api", userId: reviewerId };

  const result = await c.get("db").transaction(async tx => {
    const [submission] = await tx
      .select()
      .from(core_content_submissions)
      .where(eq(core_content_submissions.id, id))
      .limit(1)
      .for("update");
    if (!submission) throw new ContentSubmissionDecisionError("notFound");
    if (submission.status !== "pending") {
      throw new ContentSubmissionDecisionError("decided");
    }

    const cancel = async () => {
      await tx
        .update(core_content_submissions)
        .set({ decidedAt: new Date(), status: "cancelled" })
        .where(eq(core_content_submissions.id, submission.id));

      return { kind: "gone" as const };
    };

    const model = findSubmissionModel(c, submission);
    const definition = model ? contentDefinitionOf(model) : null;
    const itemId = definition
      ? parseContentId(definition.idStrategy, submission.itemId)
      : null;
    if (!model || !definition || itemId === null) return await cancel();

    const row = await lockRecord(tx, model, itemId);
    if (!row) return await cancel();

    const container = await resolveContentRowContainer(c, tx, definition, row);
    const allowed = await canModerateContent(c, {
      container,
      definition,
      permission: CONTENT_PERMISSIONS.approve,
      pluginId: submission.pluginId,
    });
    if (!allowed) throw new ContentSubmissionDecisionError("forbidden");

    const applied: Applied =
      decision === "approve"
        ? await applyApproval(c, tx, {
            actor,
            id: itemId,
            model,
            pluginId: submission.pluginId,
            row,
            submission,
          })
        : { kind: "none" };

    const [decided] = await tx
      .update(core_content_submissions)
      .set({
        containerDefinitionId:
          container?.definition.id ?? submission.containerDefinitionId,
        containerId: container?.container.id ?? submission.containerId,
        decidedAt: new Date(),
        reason: decision === "reject" ? reason : null,
        reviewerId,
        revisionId:
          applied.kind === "editorial"
            ? (applied.outcome?.revisionId ?? null)
            : null,
        status: decision === "approve" ? "approved" : "rejected",
      })
      .where(eq(core_content_submissions.id, submission.id))
      .returning();
    // In the deciding transaction, so the submitter is told exactly when the
    // decision commits.
    await recordContentModerationDecision(c, tx, decided);

    return { applied, decided, kind: "decided" as const, model };
  });

  if (result.kind === "gone") {
    throw new ContentSubmissionDecisionError("gone");
  }

  const { applied, decided, model } = result;
  if (applied.kind === "editorial") {
    await contentEditorialWriteEffects(c, model, {
      outcomes: [applied.outcome],
      pluginId: decided.pluginId,
    });
  } else if (applied.kind === "plain") {
    await contentPlainWriteEffects(c, model, {
      changedFields: applied.changedFields,
      operation: applied.operation,
      pluginId: decided.pluginId,
      row: applied.row,
    });
  }

  const payload = {
    authorId: decided.authorId,
    containerId: decided.containerId,
    contentId: decided.itemId,
    contentTypeId: decided.contentTypeId,
    kind: decided.kind,
    pluginId: decided.pluginId,
    reviewerId,
    submissionId: decided.id,
  };
  if (decided.status === "approved") {
    await c.get("events").emit("content.approval.approved", payload);
  } else {
    await c.get("events").emit("content.approval.rejected", {
      ...payload,
      reason: decided.reason,
    });
  }

  return decided;
};
