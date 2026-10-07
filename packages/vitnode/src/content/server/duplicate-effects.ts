import type { Context } from "hono";

import type { EventEmitResult } from "../../api/models/events";
import type { AnyContentTypeDefinition } from "../types";
import type {
  ContentDuplicateResult,
  ContentEditorialDuplicateOutcome,
} from "./duplicate";
import type { AnyContentModel } from "./model";

import { requireContentId } from "../ids";
import { contentEditorialEffects } from "./editorial-effects";
import { reportContentEventFailures } from "./effects-log";
import { emitContentEvent } from "./emit";
import { plainOutcome } from "./route-helpers";
import {
  contentSearchAdvancedValues,
  syncContentLocalizedSearch,
  syncContentSearch,
} from "./search-sync";
import { contentTranslationEffects } from "./translation-effects";

export type ContentDuplicateEffectsInput =
  | {
      kind: "editorial";
      outcome: ContentEditorialDuplicateOutcome<AnyContentTypeDefinition>;
    }
  | {
      kind: "plain";
      result: ContentDuplicateResult<AnyContentTypeDefinition>;
    };

export interface ContentDuplicateEffectsOptions {
  /** Who asked for the copy; `null` for the system or an API key. */
  actorUserId: null | number;
  /** The plugin that owns the content type, and therefore the events. */
  pluginId: string;
}

/**
 * Everything a committed duplicate owes the rest of the system, once.
 *
 * The copy's ordinary `created` (carrying `duplicatedFromId`) with its search
 * document, one `translation_created` per copied language, then `duplicated`.
 * Search runs exactly once per document: a localized record's base effects
 * already index every language, so the translation effects are run without the
 * model and only announce.
 */
export const contentDuplicateEffects = async (
  c: Context,
  model: AnyContentModel,
  input: ContentDuplicateEffectsInput,
  { actorUserId, pluginId }: ContentDuplicateEffectsOptions,
): Promise<{ duplicated: EventEmitResult }> => {
  const definition = model.definition as AnyContentTypeDefinition;
  const row = input.kind === "editorial" ? input.outcome.row : input.result.row;
  const sourceId =
    input.kind === "editorial" ? input.outcome.sourceId : input.result.sourceId;
  const contentId = requireContentId(
    definition.idStrategy,
    (row as { id: unknown }).id,
    definition.id,
  );

  if (input.kind === "editorial") {
    await contentEditorialEffects(c, definition, input.outcome, {
      model,
      pluginId,
    });

    for (const translation of input.outcome.translations) {
      await contentTranslationEffects(c, definition, translation, {
        pluginId,
      });
    }
  } else {
    const created = await emitContentEvent(
      c,
      definition,
      "created",
      { contentId, duplicatedFromId: sourceId },
      { pluginId },
    );
    await reportContentEventFailures(c, {
      action: "created",
      contentTypeId: definition.id,
      event: created,
      itemId: contentId,
    });

    const advanced = await contentSearchAdvancedValues(c, model, contentId);
    if (definition.localization.enabled) {
      await syncContentLocalizedSearch(c, model, {
        advanced,
        changed: true,
        operation: "create",
        pluginId,
        row,
      });
    } else {
      await syncContentSearch(c, definition, {
        advanced,
        operation: "create",
        pluginId,
        row,
      });
    }

    for (const translation of input.result.translations) {
      await contentTranslationEffects(
        c,
        definition,
        plainOutcome("create", translation),
        { pluginId },
      );
    }
  }

  const duplicated = await emitContentEvent(
    c,
    definition,
    "duplicated",
    {
      actorUserId,
      contentId,
      contentTypeId: definition.id,
      sourceId,
    },
    { pluginId },
  );
  await reportContentEventFailures(c, {
    action: "duplicated",
    contentTypeId: definition.id,
    event: duplicated,
    itemId: contentId,
  });

  return { duplicated };
};
