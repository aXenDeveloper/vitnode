import type { Context } from "hono";

import type { ContentEditorialOutcome } from "@/content/server/editorial-service";
import type { ContentScheduleEffectsPayload } from "@/content/server/schedule-effects";
import type { AnyContentTypeDefinition } from "@/content/types";

import { CONTENT_QUEUE_TASK_SCHEDULE_EFFECTS } from "@/content/const";
import { CONTENT_SYSTEM_ACTOR } from "@/content/server/actor";
import { findContentModel } from "@/content/server/model";
import {
  claimContentSchedule,
  settleContentSchedule,
} from "@/content/server/schedules-model";

/** What the run decided, so the task logs something worth reading. */
export interface ContentScheduleOutcome {
  reason?: string;
  status: "executed" | "skipped" | "unregistered";
}

/**
 * Thrown when a claimed schedule is no longer `pending` at settlement time.
 *
 * Structurally impossible: the row is locked `FOR UPDATE` from the claim to the
 * commit, so nothing else can have moved it. If it ever happens the lock was
 * not held, and rolling the whole transition back is the only safe answer -
 * publishing a record whose schedule somebody cancelled is worse than not
 * publishing it.
 */
class ContentScheduleSettlementError extends Error {
  constructor(scheduleId: number) {
    super(
      `Schedule ${scheduleId} was no longer pending at settlement time. Rolling the transition back.`,
    );

    this.name = "ContentScheduleSettlementError";
  }
}

type ScheduleTransaction =
  | { contentTypeId: string; kind: "unregistered" }
  | { effects: ContentScheduleEffectsPayload; kind: "executed" }
  | { kind: "skipped"; reason: string };

const slugOf = (
  definition: AnyContentTypeDefinition,
  row: null | Record<string, unknown> | undefined,
): null | string => {
  if (!definition.publicApi.enabled) return null;

  const value = row?.[definition.publicApi.slugField];

  return typeof value === "string" ? value : null;
};

/**
 * Everything the announcements need, frozen at the moment the transition
 * committed.
 *
 * `wasPublic` is derived rather than read back: the transition guards on the
 * state it is leaving (`status <> 'published'` to publish, `= 'published'` to
 * unpublish), so a *changed* publish came from a non-public row and a changed
 * unpublish from a public one. That removes the extra `SELECT` the old code did
 * outside the lock, and removes with it the window where the answer could have
 * been someone else's write.
 */
const effectsPayload = ({
  claimed,
  definition,
  outcome,
  pluginId,
}: {
  claimed: {
    action: "publish" | "unpublish";
    createdBy: null | number;
    id: number;
    itemId: number;
  };
  definition: AnyContentTypeDefinition;
  outcome: ContentEditorialOutcome<AnyContentTypeDefinition>;
  pluginId: string;
}): ContentScheduleEffectsPayload => {
  const row = outcome.row as unknown as Record<string, unknown>;

  return {
    changedFields: [...outcome.changedFields] as string[],
    contentTypeId: definition.id,
    itemId: claimed.itemId,
    operation: claimed.action,
    pluginId,
    // A publish and an unpublish move `status`, never a field value, so the
    // slug the record answered to before is the one it answers to now. Carried
    // anyway, because the cache bridge takes a list and a future action that
    // *does* move it should not need this file to change.
    previousSlug: outcome.previousSlug ?? slugOf(definition, row),
    revisionId: outcome.revisionId,
    row: JSON.parse(JSON.stringify(row)) as Record<string, unknown>,
    scheduleId: claimed.id,
    scheduledBy: claimed.createdBy,
    version: outcome.version,
    wasPublic: claimed.action === "unpublish",
  };
};

/**
 * Runs one scheduled transition, or decides not to.
 *
 * **One transaction, from the claim to the commit.** The old shape claimed in a
 * short transaction of its own and released the row lock before publishing,
 * which left a real window: an administrator could cancel, be told it worked,
 * and watch the article go live anyway. Now the `FOR UPDATE` taken by
 * `claimContentSchedule` is held until the transition, its revision, the
 * settlement *and* the effects task have all committed - so a concurrent cancel
 * either wins outright (before the claim) or waits and then finds the schedule
 * already `completed`, which is a truthful 404 rather than a lie.
 *
 * What is deliberately **not** in the transaction: the event, the search write
 * and the cache bridge. They talk to systems a rollback cannot reach, so they
 * are handed to `content-schedule-effects` - a queue row written in this same
 * transaction, and therefore present exactly when the transition committed.
 *
 * Almost every guard here is a **silent no-op**, and that is the design rather
 * than laziness: each one describes a schedule that is no longer the plan -
 * cancelled, rescheduled, or already run. Throwing would send the queue into a
 * retry loop over a decision that is never going to change.
 */
export const executeContentSchedule = async (
  c: Context,
  { generation, scheduleId }: { generation: number; scheduleId: number },
): Promise<ContentScheduleOutcome> => {
  const db = c.get("db");

  let result: ScheduleTransaction;
  try {
    result = await db.transaction(async (tx): Promise<ScheduleTransaction> => {
      const claimed = await claimContentSchedule(tx, {
        generation,
        scheduleId,
      });

      if (!claimed) {
        return {
          kind: "skipped",
          reason: "not pending, superseded, or not yet due",
        };
      }

      const entry = findContentModel(
        c.get("core").contentModels,
        claimed.contentTypeId,
      );
      const editorialService = entry?.model.editorialService;

      // The plugin was removed, or the content type dropped its editorial
      // block. There is nothing to publish and there never will be, so cancel
      // rather than retrying until the queue gives up - an error every ten
      // minutes forever is not a useful way to report a config change.
      if (!entry || !editorialService) {
        await settleContentSchedule(tx, claimed.id, {
          expectedStatus: "pending",
          lastError: `Content type "${claimed.contentTypeId}" is no longer registered with an editorial workflow.`,
          status: "cancelled",
        });

        return { contentTypeId: claimed.contentTypeId, kind: "unregistered" };
      }

      const { model, pluginId } = entry;

      const outcome = await editorialService(c, { pluginId })[claimed.action](
        claimed.itemId,
        {
          // No fake user id anywhere. Who *asked* for this is on the schedule
          // row and travels in the event as `scheduledBy`.
          actor: CONTENT_SYSTEM_ACTOR,
          tx,
        },
      );

      // Settled whatever happened. A record that was deleted first, or is
      // already in the state the schedule wanted, is still a schedule that
      // has had its answer - leaving it pending would retry it forever.
      if (
        !(await settleContentSchedule(tx, claimed.id, {
          expectedStatus: "pending",
          lastError: null,
          status: "completed",
        }))
      ) {
        throw new ContentScheduleSettlementError(claimed.id);
      }

      if (!outcome) {
        return { kind: "skipped", reason: "record no longer exists" };
      }
      if (!outcome.changed) {
        return { kind: "skipped", reason: "already in that state" };
      }

      const effects = effectsPayload({
        claimed,
        definition: model.definition,
        outcome,
        pluginId,
      });

      // In the transaction, so the announcement task exists if and only if
      // the transition it announces committed. A crash a millisecond later
      // loses nothing: the row is durable and the queue will drain it.
      await c.get("queue").dispatch({
        name: CONTENT_QUEUE_TASK_SCHEDULE_EFFECTS,
        payload: effects,
        // Core owns the handler. Without this the row would be stamped with
        // the requesting plugin's id and nothing would ever claim it.
        pluginId: "@vitnode/core",
        tx,
      });

      return { effects, kind: "executed" };
    });
  } catch (error) {
    // Outside the rolled-back transaction, and guarded on `pending`: by now the
    // lock is gone, so a cancel may legitimately have won the row.
    await settleContentSchedule(db, scheduleId, {
      expectedStatus: "pending",
      lastError: error instanceof Error ? error.message : "Unknown error",
    });

    // Rethrown on purpose: this one *is* worth retrying, and the queue's
    // backoff is the retry policy.
    throw error;
  }

  if (result.kind === "unregistered") {
    return { reason: result.contentTypeId, status: "unregistered" };
  }
  if (result.kind === "skipped") {
    return { reason: result.reason, status: "skipped" };
  }

  return { status: "executed" };
};
