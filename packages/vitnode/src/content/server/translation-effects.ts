import type { Context } from "hono";

import type { EventEmitResult } from "../../api/models/events";
import type { ContentEventAction } from "../events";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentTranslationEditorialOutcome } from "./translation-editorial-service";

import { emitContentEvent } from "./emit";

/** One translation operation, one event. Never `updated` - see `events.ts`. */
const EVENT_ACTION: Record<
  ContentTranslationEditorialOutcome<unknown>["operation"],
  ContentEventAction
> = {
  create: "translation_created",
  delete: "translation_deleted",
  publish: "translation_published",
  restore: "translation_restored",
  unpublish: "translation_unpublished",
  update: "translation_updated",
};

const payloadFor = (
  outcome: ContentTranslationEditorialOutcome<AnyContentTypeDefinition>,
): Record<string, unknown> => {
  const base = {
    contentId: outcome.row.itemId,
    languageId: outcome.languageId,
    locale: outcome.locale,
    // Absent rather than `undefined` when the content type keeps no history: a
    // listener that acts on a revision must not be handed one that is not there,
    // and `"revisionId" in payload` is how it checks.
    ...(outcome.revisionId === null ? {} : { revisionId: outcome.revisionId }),
    version: outcome.version,
  };

  switch (outcome.operation) {
    case "publish":
      return {
        ...base,
        publishedAt:
          (outcome.row as { publishedAt?: Date | null }).publishedAt ?? null,
      };
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

export interface ContentTranslationEffectsOptions {
  /** The plugin that owns the content type, and therefore the event. */
  pluginId: string;
}

export interface ContentTranslationEffectsResult {
  /**
   * What the event transport reported, or `null` for a no-op outcome.
   *
   * Present rather than discarded because `EventsModel.emit` does not throw:
   * `failures` is the only place a dead listener or a broker outage is visible.
   * A failure here never rolls the committed mutation back - it cannot, the
   * transaction is closed - which is exactly why the caller gets to see it.
   */
  event: EventEmitResult | null;
}

/**
 * Everything one translation mutation owes the rest of the system, once its
 * transaction has committed.
 *
 * The localized counterpart of `contentEditorialEffects`, and it exists for the
 * same reason: "which event does this operation emit" is a rule, and a rule copied
 * into six route handlers is a rule that will disagree with itself.
 *
 * **Call it only after the write has returned - never inside the transaction.** A
 * rollback cannot un-emit an event.
 *
 * A no-op outcome does nothing at all. That is what keeps a double-clicked publish
 * button and an empty edit from each producing a second event.
 *
 * Search synchronisation is deliberately absent: a localized content type cannot
 * have `search` enabled yet, so there is no document to write. Stage 5D adds the
 * per-locale sync here. Cache invalidation is absent for the reason it is absent
 * from the base effects too - it needs the Next runtime, which the API process does
 * not have, so the Server Action owns it.
 */
export const contentTranslationEffects = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  outcome: ContentTranslationEditorialOutcome<AnyContentTypeDefinition>,
  { pluginId }: ContentTranslationEffectsOptions,
): Promise<ContentTranslationEffectsResult> => {
  if (!outcome.changed) return { event: null };

  return {
    event: await emitContentEvent(
      c,
      definition,
      EVENT_ACTION[outcome.operation],
      payloadFor(outcome) as never,
      // The plugin that owns the content type, not whichever module happens to be
      // handling the request.
      { pluginId },
    ),
  };
};
