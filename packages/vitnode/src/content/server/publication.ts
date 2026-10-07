import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { and, eq, isNotNull, isNull, lte, sql } from "drizzle-orm";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentPublicationMethods, ContentService } from "./service";

import { ContentEngineError } from "../errors";

export interface PublicationColumns {
  /**
   * The base row's `hiddenAt`, present only when the content type has
   * `visibility` enabled. A translation table has none: hiding is record-level,
   * so it is always the *base* predicate that carries it.
   */
  hiddenAt?: PgColumn;
  publishedAt: PgColumn;
  status: PgColumn;
}

export const publicationColumns = (
  definition: AnyContentTypeDefinition,
  columns: Record<string, PgColumn>,
): PublicationColumns => {
  const { hiddenAt, publishedAt, status } = columns;

  if (!definition.publication.enabled || !publishedAt || !status) {
    throw new ContentEngineError(
      "The published predicate needs `publication: { enabled: true }` on the content type.",
      { contentTypeId: definition.id },
    );
  }

  if (!definition.visibility.enabled) return { publishedAt, status };

  // Thrown rather than skipped: a visibility-enabled content type read without
  // its `hiddenAt` column would quietly serve every hidden record.
  if (!hiddenAt) {
    throw new ContentEngineError(
      "`visibility` is enabled, but the column map has no `hiddenAt`. Build the columns with `contentTableColumns`.",
      { contentTypeId: definition.id },
    );
  }

  return { hiddenAt, publishedAt, status };
};

/**
 * The one SQL statement of "publicly reachable": published, already live, and -
 * for a content type with `visibility` - not hidden. Every public read builds
 * its `WHERE` from this, so a hidden record disappears everywhere at once.
 */
export const publishedCondition = (
  columns: PublicationColumns,
): SQL | undefined =>
  and(
    eq(columns.status, "published"),
    isNotNull(columns.publishedAt),
    lte(columns.publishedAt, sql`now()`),
    columns.hiddenAt === undefined ? undefined : isNull(columns.hiddenAt),
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
