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
import { contentDefinitionOf } from "./model";
import { contentPublicStateOf } from "./page-cache";
import { plainOutcome } from "./route-helpers";
import {
  contentSearchAdvancedValues,
  syncContentLocalizedSearch,
  syncContentSearch,
} from "./search-sync";
import { contentTranslationEffects } from "./translation-effects";

/** The result of a duplicate, from the editorial or the plain write path. */
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
  actorUserId: null | number;
  pluginId: string;
}

/**
 * The follow-up to a committed duplicate: the copy's create effects (its
 * `created` event, its search documents and one translation event per copied
 * translation), then the `duplicated` event. Listener failures are logged, not
 * thrown. Server-only.
 */
export const contentDuplicateEffects = async (
  c: Context,
  model: AnyContentModel,
  input: ContentDuplicateEffectsInput,
  { actorUserId, pluginId }: ContentDuplicateEffectsOptions,
): Promise<{ duplicated: EventEmitResult }> => {
  const definition = contentDefinitionOf(model);
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
      { pluginId, publicState: contentPublicStateOf(definition, null, row) },
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
    { pluginId, publicState: contentPublicStateOf(definition, null, row) },
  );
  await reportContentEventFailures(c, {
    action: "duplicated",
    contentTypeId: definition.id,
    event: duplicated,
    itemId: contentId,
  });

  return { duplicated };
};
