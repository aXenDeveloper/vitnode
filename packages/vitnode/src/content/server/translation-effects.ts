import type { Context } from "hono";

import type { EventEmitResult } from "../../api/models/events";
import type { ContentEventAction } from "../events";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentDeliveryEffectsResult } from "./delivery-effects";
import type { AnyContentModel } from "./model";
import type { ContentSearchSyncOutcome } from "./search-sync";
import type { ContentTranslationEditorialOutcome } from "./translation-editorial-service";

import { contentDeliveryEffects } from "./delivery-effects";
import { reportContentEventFailures } from "./effects-log";
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
  model?: AnyContentModel;
  /** The plugin that owns the content type, and therefore the event. */
  pluginId: string;
}

export interface ContentTranslationEffectsResult {
  /**
   * The delivery events this translation mutation emitted, or `undefined` for a
   * content type without `delivery`.
   */
  delivery?: ContentDeliveryEffectsResult;

  event: EventEmitResult | null;

  search?: ContentSearchSyncOutcome[];
}

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

  // Same rule as the base effects: the transaction is closed, so a listener that
  // never heard about this translation cannot fail the request - but it must not
  // vanish either. The locale travels with it, because "nobody heard about the
  // Polish copy" is a different incident from "nobody heard about the record".
  await reportContentEventFailures(c, {
    action: EVENT_ACTION[outcome.operation],
    contentTypeId: definition.id,
    event,
    itemId: outcome.row.itemId,
    locale: outcome.locale,
  });

  const delivery = definition.delivery.enabled
    ? await contentDeliveryEffects(c, definition, outcome.delivery, {
        pluginId,
      })
    : undefined;
  const withDelivery = delivery === undefined ? {} : { delivery };

  if (!definition.search.enabled || !model) return { ...withDelivery, event };

  // The base row, because a translation's document is built from both halves and
  // its visibility is subordinate to the record's.
  const base = await model.service(c).findById(outcome.row.itemId);
  if (!base) return { ...withDelivery, event };

  return {
    ...withDelivery,
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
