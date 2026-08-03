import type { PgColumn } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import type { ContentSchemas } from "../schemas";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentPublicService } from "./public-service";
import type { ContentService } from "./service";
import type {
  ContentColumnName,
  ContentReferences,
  ContentTableFor,
} from "./types";

import { createContentPublicService } from "./public-service";
import { createContentService } from "./service";
import { contentTableColumns, createContentTable } from "./table";

export interface ContentModel<TDefinition extends AnyContentTypeDefinition> {
  /** Column name -> Drizzle column, for filters, ordering and custom queries. */
  columns: Record<ContentColumnName<TDefinition>, PgColumn>;
  definition: TDefinition;
  /**
   * The read-only public repository, or `undefined` when the content type has
   * no `publicApi`.
   *
   * `undefined` rather than a throwing stub so the check reads naturally in a
   * route builder that has no idea which content type it was handed.
   */
  publicService:
    ((c: Context) => ContentPublicService<TDefinition>) | undefined;
  /** The definition's schemas, re-typed for this concrete content type. */
  schemas: ContentSchemas<TDefinition>;
  /** Typed repository bound to the request's database handle. */
  service: (c: Context) => ContentService<TDefinition>;
  /** The generated `pgTable`. Export it so Drizzle Kit can find it. */
  table: ContentTableFor<TDefinition>;
}

/**
 * Turns a content type definition into its database model.
 *
 * Belongs in the plugin's `src/database/<entity>.ts`, next to the table export
 * Drizzle Kit globs:
 *
 * ```ts
 * export const articleContent = createContentModel(articleContentType, {
 *   references: { category: () => example_categories.id },
 * });
 *
 * export const example_articles = articleContent.table;
 * ```
 *
 * Server-only. Never import it from a client component - and never add
 * `server-only` to this module either, since `apps/api` and `drizzle-kit` both
 * load it in plain Node, where that package throws.
 */
export const createContentModel = <
  TDefinition extends AnyContentTypeDefinition,
>(
  definition: TDefinition,
  options: { references?: ContentReferences<TDefinition["fields"]> } = {},
): ContentModel<TDefinition> => {
  const table = createContentTable(definition, options);
  const columns = contentTableColumns(definition, table);
  // `ContentTypeDefinition` declares `schemas` against its own type parameters,
  // and reading it through the `AnyContentTypeDefinition` constraint widens the
  // row types back to the base field map. The object was built from this very
  // definition, so this restores what TypeScript lost rather than asserting
  // anything new.
  const schemas: ContentSchemas<TDefinition> = definition.schemas;

  return {
    columns,
    definition,
    publicService: definition.publicApi.enabled
      ? (c: Context) =>
          createContentPublicService({ c, columns, definition, table })
      : undefined,
    schemas,
    service: (c: Context) =>
      createContentService({
        c,
        columns,
        definition,
        schemas,
        table,
      }),
    table,
  };
};
