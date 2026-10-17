import type { Context } from "hono";

import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentEditorialOutcome } from "./editorial-service";
import type { ContentModel } from "./model";

import { requireContentId } from "../ids";
import { contentEditorialEffects } from "./editorial-effects";
import { emitContentEvent } from "./emit";
import { contentPublicStateOf } from "./page-cache";
import { contentSearchAdvancedValues, syncContentSearch } from "./search-sync";

/**
 * Events and search indexing after a committed write on a content type without
 * an editorial workflow. Editorial writes go through `contentEditorialEffects`.
 */
export const contentPlainWriteEffects = async <
  TDefinition extends AnyContentTypeDefinition,
>(
  c: Context,
  model: ContentModel<TDefinition>,
  {
    changedFields = [],
    operation,
    pluginId,
    published = false,
    row,
  }: {
    changedFields?: string[];
    operation: "create" | "publish" | "update";
    pluginId: string;
    published?: boolean;
    row: Record<string, unknown>;
  },
): Promise<void> => {
  const { definition } = model;
  const id = row.id as ContentId;

  if (operation === "create") {
    await emitContentEvent(
      c,
      definition,
      "created",
      { contentId: id },
      { pluginId, publicState: contentPublicStateOf(definition, null, row) },
    );
  } else if (operation === "update" && changedFields.length > 0) {
    await emitContentEvent(
      c,
      definition,
      "updated",
      { changedFields, contentId: id },
      // An edit cannot move publication, so the row after it says both.
      { pluginId, publicState: contentPublicStateOf(definition, row, row) },
    );
  }

  if (
    (operation === "publish" || (operation === "create" && published)) &&
    row.publishedAt instanceof Date
  ) {
    await emitContentEvent(
      c,
      definition,
      "published",
      { contentId: id, publishedAt: row.publishedAt },
      {
        pluginId,
        publicState: contentPublicStateOf(
          definition,
          { ...row, status: "draft" },
          row,
        ),
      },
    );
  }

  await syncContentSearch(c, definition, {
    advanced: await contentSearchAdvancedValues(
      c,
      model,
      requireContentId(definition.idStrategy, id, definition.id),
    ),
    ...(operation === "update" ? { changedFields } : {}),
    ...(operation === "publish" ? { changed: true } : {}),
    operation,
    pluginId,
    row,
  });
};

export const contentEditorialWriteEffects = async <
  TDefinition extends AnyContentTypeDefinition,
>(
  c: Context,
  model: ContentModel<TDefinition>,
  {
    outcomes,
    pluginId,
  }: {
    outcomes: (ContentEditorialOutcome<TDefinition> | null)[];
    pluginId: string;
  },
): Promise<void> => {
  for (const outcome of outcomes) {
    if (!outcome) continue;
    await contentEditorialEffects(c, model.definition, outcome, {
      model,
      pluginId,
    });
  }
};
