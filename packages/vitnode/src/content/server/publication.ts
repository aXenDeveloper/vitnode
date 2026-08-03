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
interface PublicationColumns {
  publishedAt: PgColumn;
  status: PgColumn;
}

/**
 * The one definition of "published".
 *
 * ```sql
 * status = 'published' AND published_at IS NOT NULL AND published_at <= NOW()
 * ```
 *
 * Nothing in the engine generates a public route yet, so today this exists for
 * **hand-written plugin queries** - the supported way to expose published
 * content while the public read layer is still being built:
 *
 * ```ts
 * const rows = await c
 *   .get("db")
 *   .select({ id: articles.table.id, title: articles.table.title })
 *   .from(articles.table)
 *   .where(publishedCondition(articles.columns));
 * ```
 *
 * It is exported rather than kept internal because writing that predicate by
 * hand is exactly the thing worth getting wrong once: forget the `IS NOT NULL`
 * and a row whose timestamp was cleared leaks. The generated public service in
 * a later PR will consume this same helper, so the invariant has one definition
 * either way.
 *
 * `published_at <= now()` is always true today - `publish` only ever stamps
 * `now()` - but stating the invariant costs nothing and makes scheduled
 * publishing a purely additive change later.
 *
 * Enabling `publication` does not expose anything publicly on its own. It adds
 * the lifecycle; serving it is still your route.
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
