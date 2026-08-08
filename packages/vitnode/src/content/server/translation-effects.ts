import type { Context } from "hono";

import type { EventEmitResult } from "../../api/models/events";
import type { ContentEventAction } from "../events";
import type { AnyContentTypeDefinition } from "../types";
import type { AnyContentModel } from "./model";
import type { ContentSearchSyncOutcome } from "./search-sync";
import type { ContentTranslationEditorialOutcome } from "./translation-editorial-service";

import { emitContentEvent } from "./emit";
import {
  contentSearchAdvancedValues,
  syncContentLocalizedSearch,
} from "./search-sync";

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
  /**
   * The model, for a content type with `search`.
   *
   * A translation mutation moves exactly one language's document, and finding it
   * takes the base row and the translation table - neither of which this function
   * is otherwise given. Optional so every Stage 5B caller compiles unchanged.
   */
  model?: AnyContentModel;
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
  /**
   * What the index write reported, or `null` when there was none to do - a
   * content type without `search`, or a no-op outcome.
   *
   * A one-element array at most: a translation mutation is one language.
   */
  search?: ContentSearchSyncOutcome[];
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
 * Search synchronisation is scoped to the locale that moved: one translation is
 * one document, and rewriting the others would be work for a change none of them
 * contains. A translation that must not be indexed has its document deleted for
 * that language only. Cache invalidation is absent for the reason it is absent
 * from the base effects too - it needs the Next runtime, which the API process does
 * not have, so the Server Action owns it.
 */
export const contentTranslationEffects = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  outcome: ContentTranslationEditorialOutcome<AnyContentTypeDefinition>,
  { model, pluginId }: ContentTranslationEffectsOptions,
): Promise<ContentTranslationEffectsResult> => {
  if (!outcome.changed) return { event: null };

  const event = await emitContentEvent(
    c,
    definition,
    EVENT_ACTION[outcome.operation],
    payloadFor(outcome) as never,
    // The plugin that owns the content type, not whichever module happens to be
    // handling the request.
    { pluginId },
  );

  if (!definition.search.enabled || !model) return { event };

  // The base row, because a translation's document is built from both halves and
  // its visibility is subordinate to the record's.
  const base = await model.service(c).findById(outcome.row.itemId);
  if (!base) return { event };

  return {
    event,
    // Scoped to the locale that moved. Omitting it would rewrite every other
    // language's document for a change none of them contains.
    search: await syncContentLocalizedSearch(c, model, {
      // A translation mutation rewrites this locale's whole document, so it has
      // to carry the shared collections as well: changing `seo.description`
      // must not silently remove the indexed `faq.question` and `faq.answer`.
      advanced: await contentSearchAdvancedValues(c, model, outcome.row.itemId),
      changed: outcome.changed,
      changedFields: outcome.changedFields,
      locale: outcome.locale,
      operation: outcome.operation,
      pluginId,
      row: base,
    }),
  };
};
