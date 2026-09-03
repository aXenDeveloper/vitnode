import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { and, eq, isNotNull, lte, sql } from "drizzle-orm";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentPublicationMethods, ContentService } from "./service";

import { ContentEngineError } from "../errors";

export interface PublicationColumns {
  publishedAt: PgColumn;
  status: PgColumn;
}

export const publicationColumns = (
  definition: AnyContentTypeDefinition,
  columns: Record<string, PgColumn>,
): PublicationColumns => {
  const { publishedAt, status } = columns;

  if (!definition.publication.enabled || !publishedAt || !status) {
    throw new ContentEngineError(
      "The published predicate needs `publication: { enabled: true }` on the content type.",
      { contentTypeId: definition.id },
    );
  }

  return { publishedAt, status };
};

export const publishedCondition = (
  columns: PublicationColumns,
): SQL | undefined =>
  and(
    eq(columns.status, "published"),
    isNotNull(columns.publishedAt),
    lte(columns.publishedAt, sql`now()`),
  );

export const contentTranslationPublicationColumns = (
  definition: AnyContentTypeDefinition,
  translationColumns: Record<string, PgColumn>,
): PublicationColumns => {
  const { publishedAt, status } = translationColumns;

  if (
    !definition.localization.enabled ||
    !definition.publication.enabled ||
    !publishedAt ||
    !status
  ) {
    throw new ContentEngineError(
      "The translation published predicate needs both `localization: { enabled: true }` and `publication: { enabled: true }` on the content type.",
      { contentTypeId: definition.id },
    );
  }

  return { publishedAt, status };
};

export const contentPublicCondition = (
  base: PublicationColumns,
  translation?: PublicationColumns,
): SQL | undefined =>
  translation === undefined
    ? publishedCondition(base)
    : and(publishedCondition(base), publishedCondition(translation));

export const publicationMethods = <
  TDefinition extends AnyContentTypeDefinition,
>(
  definition: TDefinition,
  service: ContentService<TDefinition>,
): ContentPublicationMethods<TDefinition> => {
  if (!definition.publication.enabled) {
    throw new ContentEngineError(
      "publish/unpublish need `publication: { enabled: true }` on the content type.",
      { contentTypeId: definition.id },
    );
  }

  return service as unknown as ContentPublicationMethods<TDefinition>;
};
