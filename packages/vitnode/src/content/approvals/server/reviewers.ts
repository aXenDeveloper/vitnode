import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { eq } from "drizzle-orm";

import type { ContentRecordContainer } from "../../containers/server/policy";
import type { AnyContentTypeDefinition } from "../../types";
import type { ContentSubmissionRow } from "./submissions";

import {
  findStaffPermissionCandidates,
  loadStaffPermissionsOfUsers,
} from "../../../api/lib/check-staff-permission";
import { core_content_submissions } from "../../../database/content-submissions";
import { CONTENT_PERMISSIONS } from "../../const";
import { contentContainerSourceOf } from "../../containers/association";
import {
  hasContentModeratorPermission,
  loadContentRecordContainer,
  resolveContentRowContainer,
} from "../../containers/server/policy";
import { parseContentId } from "../../ids";
import { contentDefinitionOf } from "../../server/model";
import { findSubmissionModel } from "./submissions";

/** Moderators considered for one submission, at most. */
export const CONTENT_SUBMISSION_REVIEWER_LIMIT = 1000;

/** A pending submission with everything needed to tell who may review it now. */
export interface ContentSubmissionReviewScope {
  /**
   * Where the queue lists the submission (the container it was opened in) and
   * where the record is filed now - one entry when they are the same. A
   * reviewer needs `can_approve` in each: the first to open it in the Moderator
   * CP, the second to decide it.
   */
  containers: (ContentRecordContainer | null)[];
  /** Where the record is filed now. */
  current: ContentRecordContainer | null;
  definition: AnyContentTypeDefinition;
  pluginId: string;
  /** The record, as stored now. */
  row: Record<string, unknown>;
  submission: ContentSubmissionRow;
}

/**
 * Loads a submission and the record it is about, or `null` when nobody has
 * anything to review any more: it is no longer pending, it is not about
 * `expected`, its content type is unregistered or not moderated through the
 * queue, or the record is gone. Server-only.
 */
export const loadContentSubmissionReviewScope = async (
  c: Context,
  submissionId: number,
  expected?: { contentTypeId: string; itemId: string },
): Promise<ContentSubmissionReviewScope | null> => {
  const db = c.get("db");
  const [submission] = await db
    .select()
    .from(core_content_submissions)
    .where(eq(core_content_submissions.id, submissionId))
    .limit(1);
  if (
    submission?.status !== "pending" ||
    (expected &&
      (submission.contentTypeId !== expected.contentTypeId ||
        submission.itemId !== expected.itemId))
  ) {
    return null;
  }

  const model = findSubmissionModel(c, submission);
  if (!model) return null;
  const definition = contentDefinitionOf(model);
  const container = contentContainerSourceOf(definition)?.container;
  // The queue lists nothing else, so nobody could open it.
  if (!definition.publicWrite.enabled || !container?.policies.enabled) {
    return null;
  }

  const id = parseContentId(definition.idStrategy, submission.itemId);
  if (id === null) return null;
  const columns = model.columns as Record<string, PgColumn>;
  const table: PgTable = model.table;
  const [row] = (await db
    .select()
    .from(table)
    .where(eq(columns.id, id))
    .limit(1)) as Record<string, unknown>[];
  if (!row) return null;

  const current = await resolveContentRowContainer(c, db, definition, row);
  const listed =
    submission.containerId === (current?.container.id ?? null)
      ? current
      : submission.containerId === null
        ? null
        : await loadContentRecordContainer(
            db,
            container,
            submission.containerId,
          );

  return {
    containers: listed === current ? [current] : [listed, current],
    current,
    definition,
    pluginId: submission.pluginId,
    row,
    submission,
  };
};

/**
 * Which of `userIds` may review the submission now: moderators whose
 * `can_approve` for its content type covers every container of the scope -
 * the same rule the queue, the detail page and the decision apply, read fresh
 * from the database. Server-only.
 */
export const filterContentSubmissionReviewers = async (
  c: Context,
  scope: Pick<
    ContentSubmissionReviewScope,
    "containers" | "definition" | "pluginId"
  >,
  userIds: readonly number[],
): Promise<number[]> => {
  if (userIds.length === 0) return [];
  const sets = await loadStaffPermissionsOfUsers(c, {
    type: "moderator",
    userIds,
  });

  return userIds.filter(userId => {
    const set = sets.get(userId);

    return (
      set?.staff === true &&
      scope.containers.every(container =>
        hasContentModeratorPermission(set, {
          container,
          definition: scope.definition,
          permission: CONTENT_PERMISSIONS.approve,
          pluginId: scope.pluginId,
        }),
      )
    );
  });
};

/**
 * Every moderator who may review the submission now, lowest ids first.
 * Candidates are the holders of `can_approve` for the content type in any
 * scope - direct and role grants, unrestricted entries and root roles - each
 * then checked against the containers. `truncated` when there were more than
 * {@link CONTENT_SUBMISSION_REVIEWER_LIMIT} candidates and the rest were not
 * considered. Server-only.
 */
export const findContentSubmissionReviewers = async (
  c: Context,
  scope: Pick<
    ContentSubmissionReviewScope,
    "containers" | "definition" | "pluginId"
  >,
): Promise<{ truncated: boolean; userIds: number[] }> => {
  const candidates = await findStaffPermissionCandidates(c, {
    // One over the limit tells a full list from a cut one.
    limit: CONTENT_SUBMISSION_REVIEWER_LIMIT + 1,
    module: scope.definition.permissionModule,
    permission: CONTENT_PERMISSIONS.approve,
    plugin: scope.pluginId,
    type: "moderator",
  });

  return {
    truncated: candidates.length > CONTENT_SUBMISSION_REVIEWER_LIMIT,
    userIds: await filterContentSubmissionReviewers(
      c,
      scope,
      candidates.slice(0, CONTENT_SUBMISSION_REVIEWER_LIMIT),
    ),
  };
};
