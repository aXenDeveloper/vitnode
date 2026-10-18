import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { and, eq, isNotNull, isNull, lte, sql } from "drizzle-orm";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentPublicationMethods, ContentService } from "./service";

import { ContentEngineError } from "../errors";

/**
 * The columns the published predicates read. `hiddenAt` is present only when
 * the content type has `visibility`.
 */
export interface PublicationColumns {
  hiddenAt?: PgColumn;
  publishedAt: PgColumn;
  status: PgColumn;
}

/**
 * Picks the publication columns out of a model's column map, for building
 * your own published-only queries with {@link publishedCondition}.
 *
 * @throws {ContentEngineError} When the content type has no `publication`, or
 * has `visibility` but the column map has no `hiddenAt`.
 *
 * @example
 * ```ts
 * import { publicationColumns, publishedCondition } from "@vitnode/core/content/server";
 *
 * const isPublic = publishedCondition(
 *   publicationColumns(topicContent.definition, topicContent.columns),
 * );
 * ```
 */
export const publicationColumns = (
  definition: AnyContentTypeDefinition,
  columns: Record<string, PgColumn>,
): PublicationColumns => {
  const { hiddenAt, publishedAt, status } = columns;

  if (!definition.publication.enabled || !publishedAt || !status) {
    throw new ContentEngineError(
      "The published predicate needs `publication: true` on the content type.",
      { contentTypeId: definition.id },
    );
  }

  if (!definition.visibility.enabled) return { publishedAt, status };

  if (!hiddenAt) {
    throw new ContentEngineError(
      "`visibility` is enabled, but the column map has no `hiddenAt`. Build the columns with `contentTableColumns`.",
      { contentTypeId: definition.id },
    );
  }

  return { hiddenAt, publishedAt, status };
};

/**
 * The SQL condition for a publicly visible record: `status` is `published`,
 * `publishedAt` is set and not in the future (database `now()`), and - when
 * the type has visibility - `hiddenAt` is null.
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

const hiddenPublishedCondition = (
  columns: PublicationColumns,
): SQL | undefined =>
  columns.hiddenAt === undefined
    ? sql`false`
    : and(
        publishedCondition({ ...columns, hiddenAt: undefined }),
        isNotNull(columns.hiddenAt),
      );

/**
 * {@link publishedCondition}, or with `hidden: true` its opposite for hidden
 * records: published rows whose `hiddenAt` is set (`false` without visibility).
 */
export const contentPublicReadCondition = (
  columns: PublicationColumns,
  { hidden = false }: { hidden?: boolean } = {},
): SQL | undefined =>
  hidden ? hiddenPublishedCondition(columns) : publishedCondition(columns);

/**
 * {@link publicationColumns} for a localized type's translation table, whose
 * rows have their own `status` and `publishedAt`.
 *
 * @throws {ContentEngineError} Unless the type has both `localization` and
 * `publication`.
 */
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
      "The translation published predicate needs both `localization: { defaultLocale }` and `publication: true` on the content type.",
      { contentTypeId: definition.id },
    );
  }

  return { publishedAt, status };
};

/**
 * The published condition for a record and, when given, its translation: both
 * must pass {@link publishedCondition}.
 */
export const contentPublicCondition = (
  base: PublicationColumns,
  translation?: PublicationColumns,
): SQL | undefined =>
  translation === undefined
    ? publishedCondition(base)
    : and(publishedCondition(base), publishedCondition(translation));

/**
 * Narrows a content service to its publish/unpublish methods.
 *
 * @throws {ContentEngineError} When the content type has no `publication`.
 */
export const publicationMethods = <
  TDefinition extends AnyContentTypeDefinition,
>(
  definition: TDefinition,
  service: ContentService<TDefinition>,
): ContentPublicationMethods<TDefinition> => {
  if (!definition.publication.enabled) {
    throw new ContentEngineError(
      "publish/unpublish need `publication: true` on the content type.",
      { contentTypeId: definition.id },
    );
  }

  return service as unknown as ContentPublicationMethods<TDefinition>;
};
