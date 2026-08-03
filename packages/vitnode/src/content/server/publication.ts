import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { and, eq, isNotNull, lte, sql } from "drizzle-orm";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentPublicationMethods, ContentService } from "./service";

import { ContentEngineError } from "../errors";

/**
 * The one definition of "published", applied centrally so no caller has to
 * remember it.
 *
 * `published_at <= now()` is always true today - `publish` only ever stamps
 * `now()` - but stating the invariant costs nothing and makes scheduled
 * publishing a purely additive change later. `IS NOT NULL` is what keeps a row
 * whose timestamp was cleared by hand out of public results.
 */
export const publishedCondition = (
  columns: Record<string, PgColumn>,
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
