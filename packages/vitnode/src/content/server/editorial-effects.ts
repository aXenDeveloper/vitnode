import type { Context } from "hono";

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
  scheduledBy: null | number | undefined,
): Record<string, unknown> => {
  const base = {
    contentId: outcome.row.id,
    revisionId: outcome.revisionId ?? undefined,
    // Present only when a schedule caused this. A listener that wants to know
    // "was this a person, right now?" reads the envelope's actor; this answers
    // the different question of who set it up, possibly weeks ago.
    ...(scheduledBy === undefined ? {} : { scheduledBy }),
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
  {
    pluginId,
    scheduledBy,
  }: {
    pluginId: string;
    /**
     * The person who created the schedule that caused this, when one did.
     *
     * `undefined` for an interactive mutation, so the payload is unchanged
     * there - the key is absent rather than null, and nothing existing sees a
     * new field.
     */
    scheduledBy?: null | number;
  },
): Promise<{ search: ContentSearchSyncOutcome | null }> => {
  if (!outcome.changed) return { search: null };

  await emitContentEvent(
    c,
    definition,
    EVENT_ACTION[outcome.operation],
    payloadFor(outcome, scheduledBy) as never,
  );

  return {
    search: await syncContentSearch(c, definition, {
      changed: outcome.changed,
      changedFields: outcome.changedFields,
      operation: outcome.operation,
      pluginId,
      row: outcome.row,
    }),
  };
};
