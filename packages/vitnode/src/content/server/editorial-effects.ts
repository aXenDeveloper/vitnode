import type { Context } from "hono";

import type { EventEmitResult } from "../../api/models/events";
import type { ContentEventAction } from "../events";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentEditorialOutcome } from "./editorial-service";
import type { ContentSearchSyncOutcome } from "./search-sync";

import { emitContentEvent } from "./emit";
import { syncContentSearch } from "./search-sync";

/** A `delete` has no event action of its own beyond the existing one. */
const EVENT_ACTION: Record<
  ContentEditorialOutcome<unknown>["operation"],
  ContentEventAction
> = {
  create: "created",
  delete: "deleted",
  publish: "published",
  restore: "restored",
  unpublish: "unpublished",
  update: "updated",
};

const payloadFor = (
  outcome: ContentEditorialOutcome<AnyContentTypeDefinition>,
  {
    scheduledBy,
    scheduleId,
  }: Pick<ContentEditorialEffectsOptions, "scheduledBy" | "scheduleId">,
): Record<string, unknown> => {
  const base = {
    contentId: outcome.row.id,
    revisionId: outcome.revisionId ?? undefined,
    // Both present only when a schedule caused this. A listener that wants to
    // know "was this a person, right now?" reads the envelope's actor; these
    // answer the different questions of who set it up, possibly weeks ago, and
    // which booking this is - the idempotency key for a listener that must act
    // once across the effects task's retries.
    ...(scheduledBy === undefined ? {} : { scheduledBy }),
    ...(scheduleId === undefined ? {} : { scheduleId }),
    version: outcome.version,
  };

  switch (outcome.operation) {
    case "publish": {
      const publishedAt = (outcome.row as { publishedAt?: unknown })
        .publishedAt;

      return publishedAt instanceof Date
        ? { ...base, publishedAt }
        : { ...base };
    }
    case "restore":
      return {
        ...base,
        changedFields: outcome.changedFields,
        restoredFromRevisionId: outcome.restoredFromRevisionId,
      };
    case "update":
      return { ...base, changedFields: outcome.changedFields };
    default:
      return base;
  }
};

export interface ContentEditorialEffectsOptions {
  /** The plugin that owns the content type, and therefore the event. */
  pluginId: string;
  /**
   * The person who created the schedule that caused this, when one did.
   *
   * `undefined` for an interactive mutation, so the payload is unchanged
   * there - the key is absent rather than null, and nothing existing sees a
   * new field.
   */
  scheduledBy?: null | number;
  /**
   * The booking that caused this, when one did. Also `undefined` interactively.
   *
   * This is the identifier a listener uses to make itself idempotent: delivery
   * is at-least-once, so the same `published` can arrive twice, but never with
   * two different `scheduleId`s for the same booking.
   */
  scheduleId?: number;
}

export interface ContentEditorialEffectsResult {
  /**
   * What the event transport reported. `null` for a no-op outcome, which emits
   * nothing at all.
   *
   * Present rather than discarded because `EventsModel.emit` does not throw:
   * `failures` is the only place a dead listener or a broker outage is visible,
   * and a caller that ignores it has decided - explicitly or not - that the
   * event is allowed to go missing.
   */
  event: EventEmitResult | null;
  search: ContentSearchSyncOutcome | null;
}

/**
 * Everything one editorial mutation owes the rest of the system, once its
 * transaction has committed.
 *
 * One function rather than the same four-line block in every route and in the
 * queue handler: "which event, and which search operation" is a rule, and a
 * rule copied into three places is a rule that will disagree with itself. The
 * generated routes call it, and so does the scheduled-publication task.
 *
 * **Call it only after the write has returned - never inside the transaction.**
 * Same rule `syncContentSearch` states for itself, and for the same reason: a
 * rollback cannot un-emit an event or un-index a document.
 *
 * A no-op outcome does nothing at all. That is what keeps a double-clicked
 * publish button, a retried queue task and an empty edit from each producing a
 * second event and a second index write.
 *
 * Cache invalidation is deliberately **not** here. It needs the Next runtime,
 * which neither the API process nor the queue worker has; the Server Action
 * owns it, and the scheduled path goes through the revalidation bridge.
 */
export const contentEditorialEffects = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  outcome: ContentEditorialOutcome<AnyContentTypeDefinition>,
  { pluginId, scheduledBy, scheduleId }: ContentEditorialEffectsOptions,
): Promise<ContentEditorialEffectsResult> => {
  if (!outcome.changed) return { event: null, search: null };

  const event = await emitContentEvent(
    c,
    definition,
    EVENT_ACTION[outcome.operation],
    payloadFor(outcome, { scheduledBy, scheduleId }) as never,
    // The plugin that owns the content type, not whichever module happens to be
    // handling the request. Passed on every path, interactive and scheduled, so
    // the envelope's owner is a property of the event rather than of how it was
    // triggered.
    { pluginId },
  );

  return {
    event,
    search: await syncContentSearch(c, definition, {
      changed: outcome.changed,
      changedFields: outcome.changedFields,
      operation: outcome.operation,
      pluginId,
      row: outcome.row,
    }),
  };
};
