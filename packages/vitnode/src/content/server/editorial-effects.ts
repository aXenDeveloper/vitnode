import type { Context } from "hono";

import type { EventEmitResult } from "../../api/models/events";
import type { ContentEventAction } from "../events";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentEditorialOutcome } from "./editorial-service";
import type { AnyContentModel } from "./model";
import type { ContentSearchSyncOutcome } from "./search-sync";

import { emitContentEvent } from "./emit";
import {
  contentSearchAdvancedValues,
  syncContentLocalizedSearch,
  syncContentSearch,
} from "./search-sync";

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
  /**
   * The model, for a **localized** content type with `search`.
   *
   * Needed because such a record is indexed once per published translation, and
   * enumerating them takes a table this function is not otherwise given. Optional
   * so every existing caller compiles unchanged; a localized searchable content
   * type whose caller omits it has its index write skipped and says so in the log,
   * rather than silently indexing one language.
   */
  model?: AnyContentModel;
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
  /**
   * One outcome per language, for a localized content type. Empty for every
   * other one, whose single outcome is on `search`.
   */
  searchByLocale?: ContentSearchSyncOutcome[];
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
  { model, pluginId, scheduledBy, scheduleId }: ContentEditorialEffectsOptions,
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

  // A localized record is indexed once per published translation, and a mutation
  // of the *record* moves every one of them: its publication state gates them
  // all, and a shared field is in all of them.
  if (definition.localization.enabled && definition.search.enabled) {
    return {
      event,
      search: null,
      searchByLocale: model
        ? await syncContentLocalizedSearch(c, model, {
            // A shared field moved, so **every** locale's document is rewritten
            // - and each rewrite has to carry the shared collections too, or a
            // title edit would drop the FAQ out of every language at once.
            advanced: await contentSearchAdvancedValues(
              c,
              model,
              idOf(outcome.row),
            ),
            changed: outcome.changed,
            changedFields: outcome.changedFields,
            operation: outcome.operation,
            pluginId,
            row: outcome.row,
          })
        : await warnMissingModel(c, definition),
    };
  }

  return {
    event,
    search: await syncContentSearch(c, definition, {
      // Read back only when a document is actually made of collection values,
      // and only the collections it names. A content type that indexes none -
      // which is every Stage 1-5 one - pays for nothing here.
      advanced: model
        ? await contentSearchAdvancedValues(c, model, idOf(outcome.row))
        : undefined,
      changed: outcome.changed,
      changedFields: outcome.changedFields,
      operation: outcome.operation,
      pluginId,
      row: outcome.row,
    }),
  };
};

/** The record's own identifier, off a row whose type is still open. */
const idOf = (row: object): number => {
  const id = (row as { id?: unknown }).id;

  return typeof id === "number" ? id : 0;
};

/**
 * Says why nothing was indexed, rather than indexing the wrong thing.
 *
 * Reachable only from a hand-written caller: every generated path passes the
 * model. Logging beats throwing here because the write has already committed -
 * failing now would report a successful mutation as a failure - and it beats
 * silence because the symptom otherwise is a search index that is quietly missing
 * one content type.
 */
const warnMissingModel = async (
  c: Context,
  definition: AnyContentTypeDefinition,
): Promise<ContentSearchSyncOutcome[]> => {
  const message = `[content-search] ${definition.id} is localized and searchable, but contentEditorialEffects was called without \`model\`, so no document was written. Pass the content model.`;

  try {
    await c.get("log").error(message);
  } catch {
    // eslint-disable-next-line no-console
    console.error(`[VitNode] ${message}`);
  }

  return [];
};
