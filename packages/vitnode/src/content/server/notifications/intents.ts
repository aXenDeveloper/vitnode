import type { Context } from "hono";

import { and, eq, or } from "drizzle-orm";

import type { ContentNotificationIntent } from "../../../api/modules/content/tasks/content-notifications.task";
import type { ContentSubmissionRow } from "../../approvals/server/submissions";
import type { ContentId } from "../../ids";
import type { AnyContentTypeDefinition } from "../../types";
import type { ContentDatabase } from "../service";
import type { ContentNotificationRegistry } from "./registry";

import { contentNotificationsQueueTask } from "../../../api/modules/content/tasks/content-notifications.task";
import { core_notification_events } from "../../../database/notifications";
import { contentIdKey } from "../../ids";

const MAX_ATTEMPTS = 5;

/** The idempotency key of a submission's "waiting for approval" event: one per submission, ever. */
export const contentApprovalPendingKey = (
  submission: Pick<ContentSubmissionRow, "contentTypeId" | "id">,
): string => `approval:${submission.contentTypeId}:${submission.id}`;

export const contentNotificationRegistryOf = (
  c: Context,
): ContentNotificationRegistry | undefined =>
  (
    c.get("core") as
      | undefined
      | { contentNotifications?: ContentNotificationRegistry }
  )?.contentNotifications;

/** Whether publishing a record of this type can notify anyone - and so whether its first publication must be detected. */
export const hasContentFirstPublicationRules = (
  c: Context,
  definition: AnyContentTypeDefinition,
): boolean =>
  (contentNotificationRegistryOf(c)?.rulesFor(definition.id, "firstPublication")
    .length ?? 0) > 0;

/** Whether deleting a record of this type leaves notifications to clean up. */
export const hasContentNotificationDependents = (
  c: Context,
  definition: AnyContentTypeDefinition,
): boolean =>
  contentNotificationRegistryOf(c)?.hasDependents(definition.id) ?? false;

/**
 * The operation's actor: an explicit content actor wins (`null` for a system
 * write such as a scheduled publish), then the AdminCP admin, then the
 * signed-in member.
 */
export const contentNotificationActorId = (
  c: Context,
  actor?: null | { userId: null | number },
): null | number => {
  if (actor) return actor.userId;
  const admin = c.get("admin") as undefined | { user?: { id?: number } };
  const user = c.get("user") as null | undefined | { id?: number };

  return admin?.user?.id ?? user?.id ?? null;
};

const dispatchIntent = async (
  c: Context,
  tx: ContentDatabase,
  intent: ContentNotificationIntent,
): Promise<void> => {
  const queued = await c
    .get("queue")
    .dispatch(contentNotificationsQueueTask, intent, {
      maxAttempts: MAX_ATTEMPTS,
      tx,
    });

  // Processed right after the response when the write came from a request;
  // a rolled-back write leaves nothing to claim. The queue cron covers the
  // rest, including writes made by background tasks.
  if (queued.id !== null) {
    (
      c.get("notifications") as
        | undefined
        | { processAfterResponse?: (queueId: number) => void }
    )?.processAfterResponse?.(queued.id);
  }
};

/**
 * Stores the intent for a record's first publication. Call it inside the
 * transaction that moved `publishedAt` from `NULL` to a date, so the intent
 * commits or rolls back with the publication. A no-op without matching rules.
 */
export const recordContentFirstPublication = async (
  c: Context,
  tx: ContentDatabase,
  {
    actorId,
    definition,
    itemId,
  }: {
    actorId: null | number;
    definition: AnyContentTypeDefinition;
    itemId: ContentId;
  },
): Promise<void> => {
  const rules =
    contentNotificationRegistryOf(c)?.rulesFor(
      definition.id,
      "firstPublication",
    ) ?? [];
  if (rules.length === 0) return;

  await dispatchIntent(c, tx, {
    actorId,
    contentTypeId: definition.id,
    itemId: contentIdKey(itemId),
    ruleIds: rules.map(entry => entry.rule.type.id),
    trigger: "firstPublication",
    v: 1,
  });
};

/**
 * Stores the intent for a moderation decision, inside the transaction that
 * decided the submission. A no-op without matching rules.
 */
export const recordContentModerationDecision = async (
  c: Context,
  tx: ContentDatabase,
  submission: Pick<
    ContentSubmissionRow,
    "contentTypeId" | "id" | "itemId" | "reviewerId" | "status"
  >,
): Promise<void> => {
  const { status } = submission;
  if (status !== "approved" && status !== "rejected") return;

  const rules = (
    contentNotificationRegistryOf(c)?.rulesFor(
      submission.contentTypeId,
      "moderationDecision",
    ) ?? []
  ).filter(
    entry =>
      entry.rule.kind !== "moderationDecision" ||
      entry.rule.decisions.includes(status),
  );
  if (rules.length === 0) return;

  await dispatchIntent(c, tx, {
    actorId: submission.reviewerId,
    contentTypeId: submission.contentTypeId,
    decision: status,
    itemId: submission.itemId,
    ruleIds: rules.map(entry => entry.rule.type.id),
    submissionId: submission.id,
    trigger: "moderationDecision",
    v: 1,
  });
};

/**
 * Stores a cleanup intent for a deleted record, inside the deleting
 * transaction: its notifications, and those about records in its thread, are
 * removed from inboxes once it commits. A no-op when no rule involves the type.
 */
export const recordContentNotificationCleanup = async (
  c: Context,
  tx: ContentDatabase,
  {
    definition,
    itemId,
  }: { definition: AnyContentTypeDefinition; itemId: ContentId },
): Promise<void> => {
  if (!hasContentNotificationDependents(c, definition)) return;

  await dispatchIntent(c, tx, {
    contentTypeId: definition.id,
    itemId: contentIdKey(itemId),
    trigger: "deleted",
    v: 1,
  });
};

/**
 * Stores the intent to tell moderators a submission waits for them, inside
 * the transaction that opened it - a rolled-back write leaves nothing behind.
 * A no-op without an `approvalPending` rule for the content type.
 */
export const recordContentApprovalSubmitted = async (
  c: Context,
  tx: ContentDatabase,
  submission: Pick<ContentSubmissionRow, "contentTypeId" | "id" | "itemId">,
): Promise<void> => {
  const rules =
    contentNotificationRegistryOf(c)?.rulesFor(
      submission.contentTypeId,
      "approvalSubmitted",
    ) ?? [];
  if (rules.length === 0) return;

  await dispatchIntent(c, tx, {
    contentTypeId: submission.contentTypeId,
    itemId: submission.itemId,
    ruleIds: rules.map(entry => entry.rule.type.id),
    submissionId: submission.id,
    trigger: "approvalSubmitted",
    v: 1,
  });
};

/**
 * Stores a cleanup intent for a submission that stopped waiting - decided,
 * superseded or cancelled - inside the transaction that changed it, so the
 * moderators' "waiting for approval" items leave their inboxes once it
 * commits. Call it after the submission row is locked: a delivery in progress
 * holds that lock, so its event is visible here. A no-op when no such event
 * was published.
 */
export const recordContentApprovalResolved = async (
  c: Context,
  tx: ContentDatabase,
  submission: Pick<ContentSubmissionRow, "contentTypeId" | "id" | "itemId">,
): Promise<void> => {
  const rules =
    contentNotificationRegistryOf(c)?.rulesFor(
      submission.contentTypeId,
      "approvalSubmitted",
    ) ?? [];
  if (rules.length === 0) return;

  const idempotencyKey = contentApprovalPendingKey(submission);
  const [published] = await tx
    .select({ id: core_notification_events.id })
    .from(core_notification_events)
    .where(
      or(
        ...rules.map(entry =>
          and(
            eq(core_notification_events.pluginId, entry.pluginId),
            eq(core_notification_events.type, entry.rule.type.id),
            eq(core_notification_events.idempotencyKey, idempotencyKey),
          ),
        ),
      ),
    )
    .limit(1);
  if (!published) return;

  await dispatchIntent(c, tx, {
    contentTypeId: submission.contentTypeId,
    itemId: submission.itemId,
    ruleIds: rules.map(entry => entry.rule.type.id),
    submissionId: submission.id,
    trigger: "approvalResolved",
    v: 1,
  });
};
