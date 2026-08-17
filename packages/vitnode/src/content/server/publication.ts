import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { and, eq, isNotNull, lte, sql } from "drizzle-orm";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentPublicationMethods, ContentService } from "./service";

import { ContentEngineError } from "../errors";

/**
 * The two columns `publication: { enabled: true }` generates.
 *
 * Structural on purpose: a `ContentModel`'s `columns` map satisfies it only when
 * publication is enabled, because `ContentColumnName` adds those two names under
 * the same conditional. Passing the columns of a content type without
 * publication is therefore a compile error rather than a query against columns
 * that do not exist.
 */
export interface PublicationColumns {
  publishedAt: PgColumn;
  status: PgColumn;
}

/**
 * Picks the two publication columns out of a model's column map.
 *
 * Generic code is written against `AnyContentTypeDefinition`, whose
 * `publication.enabled` is `boolean`, so its `columns` map is a plain
 * `Record<string, PgColumn>` and does not satisfy {@link PublicationColumns}.
 * This is the runtime step that makes it true - a real presence check rather
 * than a cast, since the whole point of narrowing the parameter was to stop
 * `undefined` reaching Drizzle.
 */
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

/**
 * The one definition of "published".
 *
 * ```sql
 * status = 'published' AND published_at IS NOT NULL AND published_at <= NOW()
 * ```
 *
 * The generated public read layer applies this centrally: every method on
 * `model.publicService` `and`s it in itself, so there is no argument a caller
 * could forget, and the two generated public routes go through that service.
 *
 * It is also exported for **hand-written plugin queries**, which is where the
 * predicate would otherwise be retyped by hand - exactly the thing worth
 * getting wrong once, because forgetting the `IS NOT NULL` leaks a row whose
 * timestamp was cleared:
 *
 * ```ts
 * const rows = await c
 *   .get("db")
 *   .select({ id: articles.table.id, title: articles.table.title })
 *   .from(articles.table)
 *   .where(
 *     publishedCondition(publicationColumns(articleContentType, articles.columns)),
 *   );
 * ```
 *
 * One definition either way, so a custom route and a generated one can never
 * disagree about what "published" means.
 *
 * `published_at <= now()` is always true today - `publish` only ever stamps
 * `now()` - but stating the invariant costs nothing and makes scheduled
 * publishing a purely additive change later.
 *
 * Enabling `publication` still exposes nothing on its own: it adds the
 * lifecycle, and `publicApi.enabled` is what generates the public routes. On a
 * content type without that block, this predicate is only ever reached by a
 * route you wrote.
 */
export const publishedCondition = (
  columns: PublicationColumns,
): SQL | undefined =>
  and(
    eq(columns.status, "published"),
    isNotNull(columns.publishedAt),
    lte(columns.publishedAt, sql`now()`),
  );

/**
 * The publication pair on a generated **translation** table.
 *
 * Its own function rather than a second argument to {@link publicationColumns}
 * because the two check different things: a translation carries `status` and
 * `publishedAt` only when the *base* content type has publication, and a
 * localized content type without it has translations that are simply always
 * visible once the record is.
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
      "The translation published predicate needs both `localization: { enabled: true }` and `publication: { enabled: true }` on the content type.",
      { contentTypeId: definition.id },
    );
  }

  return { publishedAt, status };
};

/**
 * The one definition of **publicly visible**.
 *
 * For a Stage 1-4 content type it is {@link publishedCondition} on the base row
 * and nothing else. For a localized one it is that *and* the same predicate on the
 * translation being served - subordination, stated once, in SQL:
 *
 * ```sql
 * base.status = 'published'  AND base.published_at IS NOT NULL  AND base.published_at <= NOW()
 * AND t.status = 'published' AND t.published_at    IS NOT NULL  AND t.published_at    <= NOW()
 * ```
 *
 * Two clauses of the same predicate rather than a second predicate, which is what
 * keeps "published" from meaning one thing for a record and a slightly different
 * thing for its Polish translation. `isContentTranslationPubliclyVisible` is the
 * JavaScript half, written the same way for the same reason.
 *
 * A published record with an unpublished translation is **not** public in that
 * language. It may still be public in another one - that is what fallback decides,
 * and the fallback is applied by choosing *which* translation this predicate is
 * evaluated against, never by relaxing it.
 */
export const contentPublicCondition = (
  base: PublicationColumns,
  translation?: PublicationColumns,
): SQL | undefined =>
  translation === undefined
    ? publishedCondition(base)
    : and(publishedCondition(base), publishedCondition(translation));

/**
 * Narrows a service to its publication methods.
 *
 * Route and module code is generic over `AnyContentTypeDefinition`, whose
 * `publication.enabled` is `boolean` rather than `true`, so the conditional
 * members resolve to `never` there. Every call site checks
 * `definition.publication.enabled` first - this is the accompanying type-level
 * step, in the same spirit as the `isReferenceField` predicate in `routes.ts`.
 */
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
