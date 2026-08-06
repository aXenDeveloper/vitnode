import type { Context } from "hono";

import type { ContentEditorialOutcome } from "@/content/server/editorial-service";
import type { AnyContentModel } from "@/content/server/model";
import type { AnyContentTypeDefinition } from "@/content/types";

import { isContentPubliclyVisible } from "@/content/cache";
import { CONTENT_SYSTEM_ACTOR } from "@/content/server/actor";
import { contentEditorialEffects } from "@/content/server/editorial-effects";
import { findContentModel } from "@/content/server/model";
import { dispatchContentRevalidation } from "@/content/server/revalidate-bridge";
import {
  claimContentSchedule,
  settleContentSchedule,
} from "@/content/server/schedules-model";

/** What the run decided, so the task logs something worth reading. */
export interface ContentScheduleOutcome {
  reason?: string;
  status: "executed" | "skipped" | "unregistered";
}

const publicStateOf = (row: null | Record<string, unknown> | undefined) =>
  isContentPubliclyVisible({
    publishedAt: row?.publishedAt as Date | null | string | undefined,
    status: row?.status as string | undefined,
  });

const slugsOf = (
  model: AnyContentModel,
  ...rows: (null | Record<string, unknown> | undefined)[]
): string[] => {
  if (!model.definition.publicApi.enabled) return [];

  const field = model.definition.publicApi.slugField;

  return rows
    .map(row => row?.[field])
    .filter((slug): slug is string => typeof slug === "string");
};

/**
 * Runs one scheduled transition, or decides not to.
 *
 * Almost every guard here is a **silent no-op**, and that is the design rather
 * than laziness: each one describes a schedule that is no longer the plan -
 * cancelled, rescheduled, or already run. Throwing would send the queue into a
 * retry loop over a decision that is never going to change.
 *
 * The one thing that does throw is a real failure of the transition itself, so
 * the queue's existing backoff applies and the row is retried.
 */
export const executeContentSchedule = async (
  c: Context,
  { generation, scheduleId }: { generation: number; scheduleId: number },
): Promise<ContentScheduleOutcome> => {
  const db = c.get("db");

  // Claimed in its own short transaction. Holding the row lock across the whole
  // publish would keep it open for the duration of a search sync and an HTTP
  // hop; the status flip to `completed` is what stops a second run, and that
  // happens inside the write transaction below.
  const claimed = await db.transaction(
    async tx => await claimContentSchedule(tx, { generation, scheduleId }),
  );

  if (!claimed) {
    return {
      reason: "not pending, superseded, or not yet due",
      status: "skipped",
    };
  }

  const entry = findContentModel(
    c.get("core").contentModels,
    claimed.contentTypeId,
  );
  const editorialService = entry?.model.editorialService;

  // The plugin was removed, or the content type dropped its editorial block.
  // There is nothing to publish and there never will be, so cancel rather than
  // retrying until the queue gives up - an error every ten minutes forever is
  // not a useful way to report a config change.
  if (!entry || !editorialService) {
    await settleContentSchedule(db, claimed.id, {
      lastError: `Content type "${claimed.contentTypeId}" is no longer registered with an editorial workflow.`,
      status: "cancelled",
    });

    return { reason: claimed.contentTypeId, status: "unregistered" };
  }

  const { model, pluginId } = entry;
  const editorial = editorialService(c, { pluginId });

  // Read before the write, for the same reason the AdminCP action does: the old
  // slug is gone once the transition returns, and expiring the wrong tag leaves
  // a moved URL resolving.
  const before = (await model
    .service(c)
    .findById(claimed.itemId)) as null | Record<string, unknown>;
  const wasPublic = publicStateOf(before);

  let outcome: ContentEditorialOutcome<AnyContentTypeDefinition> | null;
  try {
    outcome = await db.transaction(async tx => {
      const result = await editorial[claimed.action](claimed.itemId, {
        // No fake user id anywhere. Who *asked* for this is on the schedule row
        // and travels in the event as `scheduledBy`.
        actor: CONTENT_SYSTEM_ACTOR,
        tx,
      });

      // Settled either way. An already-published record means the schedule got
      // what it wanted; leaving it pending would retry it forever.
      await settleContentSchedule(tx, claimed.id, {
        lastError: null,
        status: "completed",
      });

      return result;
    });
  } catch (error) {
    await settleContentSchedule(db, claimed.id, {
      lastError: error instanceof Error ? error.message : "Unknown error",
    });

    // Rethrown on purpose: this one *is* worth retrying, and the queue's
    // backoff is the retry policy.
    throw error;
  }

  // The record was deleted between the schedule and its execution.
  if (!outcome) return { reason: "record no longer exists", status: "skipped" };
  if (!outcome.changed) {
    return { reason: "already in that state", status: "skipped" };
  }

  // Post-commit, through the same helper the interactive routes use - so a
  // scheduled publish and a clicked one are indistinguishable to every listener
  // and to the search index.
  await contentEditorialEffects(c, model.definition, outcome, {
    pluginId,
    scheduledBy: claimed.createdBy,
  });

  const row = outcome.row as Record<string, unknown>;

  // The cache is the one effect this process cannot perform, so it goes over
  // the bridge. Best effort: a failure must not re-run the publish.
  await dispatchContentRevalidation(c, {
    contentTypeId: model.definition.id,
    id: claimed.itemId,
    isPublic: publicStateOf(row),
    mode: "immediate",
    // Both, because an unpublish has to expire the URL it used to answer to.
    slugs: slugsOf(model, before, row),
    wasPublic,
  });

  return { status: "executed" };
};
