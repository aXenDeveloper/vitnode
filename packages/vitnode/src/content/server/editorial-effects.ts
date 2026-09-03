import type { Context } from "hono";

import type { EventEmitResult } from "../../api/models/events";
import type { ContentEventAction } from "../events";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentDeliveryEffectsResult } from "./delivery-effects";
import type { ContentEditorialOutcome } from "./editorial-service";
import type { AnyContentModel } from "./model";
import type { ContentSearchSyncOutcome } from "./search-sync";

import { contentDeliveryEffects } from "./delivery-effects";
import { reportContentEventFailures } from "./effects-log";
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
  model?: AnyContentModel;
  /** The plugin that owns the content type, and therefore the event. */
  pluginId: string;

  scheduledBy?: null | number;

  scheduleId?: number;
}

export interface ContentEditorialEffectsResult {
  delivery?: ContentDeliveryEffectsResult;

  event: EventEmitResult | null;
  search: ContentSearchSyncOutcome | null;
  /**
   * One outcome per language, for a localized content type. Empty for every
   * other one, whose single outcome is on `search`.
   */
  searchByLocale?: ContentSearchSyncOutcome[];
}

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

  // Logged here rather than left to each caller. The scheduled path additionally
  // records the failure on the schedule row and retries; an interactive route
  // does neither, and without this a dead listener on a clicked publish would be
  // invisible everywhere. The write has committed either way, so the response
  // stays a success - see `reportContentEventFailures`.
  await reportContentEventFailures(c, {
    action: EVENT_ACTION[outcome.operation],
    contentTypeId: definition.id,
    event,
    itemId: idOf(outcome.row),
  });

  // After the ordinary event, never instead of it: a URL moving and a field moving
  // are two facts, and a listener that mirrors content wants the first while one
  // that warms a CDN wants the second.
  const delivery = definition.delivery.enabled
    ? await contentDeliveryEffects(c, definition, outcome.delivery, {
        pluginId,
      })
    : undefined;

  // A localized record is indexed once per published translation, and a mutation
  // of the *record* moves every one of them: its publication state gates them
  // all, and a shared field is in all of them.
  if (definition.localization.enabled && definition.search.enabled) {
    return {
      ...(delivery === undefined ? {} : { delivery }),
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
            // The base row not moving is not the same as nothing moving. A
            // record whose languages were still drafts publishes them without
            // touching a base column, and those documents are exactly the ones
            // that were missing from the index.
            changed: outcome.changed || (outcome.movedTranslations ?? 0) > 0,
            changedFields: outcome.changedFields,
            operation: outcome.operation,
            pluginId,
            row: outcome.row,
          })
        : await warnMissingModel(c, definition),
    };
  }

  return {
    ...(delivery === undefined ? {} : { delivery }),
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
