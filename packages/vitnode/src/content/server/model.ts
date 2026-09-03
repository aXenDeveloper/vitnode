import type { PgColumn } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import type { ContentSchemas, ContentTranslationSchemas } from "../schemas";
import type {
  AnyContentTypeDefinition,
  ResolvedContentLocalizationConfig,
} from "../types";
import type { ContentAdvancedStore } from "./advanced-store";
import type { ContentDeliveryService } from "./delivery-service";
import type { ContentEditorialService } from "./editorial-service";
import type { ContentLocalizedService } from "./localized-service";
import type { ContentPublicService } from "./public-service";
import type { ContentService } from "./service";
import type { ContentTranslationEditorialService } from "./translation-editorial-service";
import type { ContentTranslationModel } from "./translation-model";
import type {
  ContentAdvancedTables,
  ContentColumnName,
  ContentReferences,
  ContentTableFor,
  ContentTranslationColumnName,
  ContentTranslationTableFor,
} from "./types";

import { ContentEngineError } from "../errors";
import { createContentAdvancedStore } from "./advanced-store";
import { createContentAdvancedTables } from "./advanced-tables";
import { createContentDeliveryService } from "./delivery-service";
import { createContentEditorialService } from "./editorial-service";
import { createContentLocalizedPublicService } from "./localized-public-service";
import { createContentLocalizedService } from "./localized-service";
import { createContentPublicService } from "./public-service";
import { createContentService } from "./service";
import { contentTableColumns, createContentTable } from "./table";
import { createContentTranslationEditorialService } from "./translation-editorial-service";
import { createContentTranslationModel } from "./translation-model";
import {
  contentTranslationTableColumns,
  createContentTranslationTable,
} from "./translation-table";

export interface ContentModel<TDefinition extends AnyContentTypeDefinition> {
  advanced: ContentAdvancedStore;

  advancedTables: ContentAdvancedTables;
  /** Column name -> Drizzle column, for filters, ordering and custom queries. */
  columns: Record<ContentColumnName<TDefinition>, PgColumn>;
  definition: TDefinition;

  deliveryService:
    | ((c: Context, options: { pluginId: string }) => ContentDeliveryService)
    | undefined;

  editorialService:
    | ((
        c: Context,
        options: { pluginId: string },
      ) => ContentEditorialService<TDefinition>)
    | undefined;

  localization: ResolvedContentLocalizationConfig;

  localizedService:
    | ((
        c: Context,
        options?: { pluginId?: string },
      ) => ContentLocalizedService<TDefinition>)
    | undefined;

  publicService:
    ((c: Context) => ContentPublicService<TDefinition>) | undefined;
  /** The definition's schemas, re-typed for this concrete content type. */
  schemas: ContentSchemas<TDefinition>;
  /** Typed repository bound to the request's database handle. */
  service: (c: Context) => ContentService<TDefinition>;
  /** The generated `pgTable`. Export it so Drizzle Kit can find it. */
  table: ContentTableFor<TDefinition>;
  /**
   * Column name -> Drizzle column on the translation table, or `null` when the
   * content type is not localized.
   */
  translationColumns: null | Record<
    ContentTranslationColumnName<TDefinition>,
    PgColumn
  >;

  translationEditorialService:
    | ((
        c: Context,
        options: { pluginId: string },
      ) => ContentTranslationEditorialService<TDefinition>)
    | undefined;
  /** The per-language schemas, or `null`. Mirrored off `schemas.translation`. */
  translationSchemas: ContentTranslationSchemas<TDefinition> | null;

  translationService:
    ((c: Context) => ContentTranslationModel<TDefinition>) | undefined;

  translationTable: ContentTranslationTableFor<TDefinition> | null;
}

export type AnyContentModel = ContentModel<
  // Deliberately `any` rather than `AnyContentTypeDefinition`, and
  // load-bearing. `ContentModel` mentions its definition in both directions -
  // `create` takes `ContentCreateInput<TDefinition>`, `findMany` returns
  // `ContentListRow<TDefinition>` - so it is genuinely invariant. It only ever
  // looked covariant because TypeScript measured the parameter's variance and
  // took the fast path; Drizzle v1 types its columns through a conditional
  // `infer`, which makes that measurement unreliable and forces the full
  // structural comparison the fast path used to skip.
  //
  // `any` states the erasure outright instead of leaning on a compiler
  // heuristic, and it is the same escape hatch Drizzle uses for `AnyPgTable`
  // and `AnyPgColumn`.
  //
  // It has to stay exactly this and nothing more. Narrowing a member - even
  // just `definition` - makes it a distinct type rather than an alias, and
  // TypeScript then structurally compares every concrete `ContentModel<T>`
  // against it, which is the comparison being avoided. Read the definition
  // back through `contentDefinitionOf` instead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>;

export const contentDefinitionOf = (
  model: AnyContentModel,
): AnyContentTypeDefinition => model.definition as AnyContentTypeDefinition;

export interface RegisteredContentModel {
  model: AnyContentModel;
  pluginId: string;
}

/** Finds the model for one content type id, or `undefined`. */
export const findContentModel = (
  models: readonly RegisteredContentModel[],
  contentTypeId: string,
): RegisteredContentModel | undefined =>
  models.find(entry => entry.model.definition.id === contentTypeId);

export const createContentModel = <
  TDefinition extends AnyContentTypeDefinition,
>(
  definition: TDefinition,
  options: { references?: ContentReferences<TDefinition["fields"]> } = {},
): ContentModel<TDefinition> => {
  const table = createContentTable(definition, options);
  const columns = contentTableColumns(definition, table);
  const advancedTables = createContentAdvancedTables(definition, {
    ...options,
    table,
  });
  // One store per model rather than one per request: it holds only the resolved
  // tables and the memoised foreign-key targets, and every method takes the
  // database handle it should run on.
  const advanced: ContentAdvancedStore = createContentAdvancedStore({
    definition,
    table,
    tables: advancedTables,
  });
  // `ContentTypeDefinition` declares `schemas` against its own type parameters,
  // and reading it through the `AnyContentTypeDefinition` constraint widens the
  // row types back to the base field map. The object was built from this very
  // definition, so this restores what TypeScript lost rather than asserting
  // anything new.
  const schemas: ContentSchemas<TDefinition> = definition.schemas;

  const localized = definition.localization.enabled;
  const translationTable = localized
    ? createContentTranslationTable(definition, { table })
    : null;
  const translationColumns = translationTable
    ? contentTranslationTableColumns(definition, translationTable)
    : null;
  const translationSchemas = schemas.translation;

  const buildTranslations = (
    c: Context,
  ): ContentTranslationModel<TDefinition> => {
    if (!translationTable || !translationColumns || !translationSchemas) {
      throw new ContentEngineError(
        "This content type has no `localization` block, so it has no translations.",
        { contentTypeId: definition.id },
      );
    }

    return createContentTranslationModel({
      c,
      columns: translationColumns,
      definition,
      schemas: translationSchemas,
      table,
      translationTable,
    });
  };

  const model: ContentModel<TDefinition> = {
    advanced,
    advancedTables,
    columns,
    definition,
    // Reads `model` lazily, which is what lets the delivery service be built from
    // the finished model without a circular construction: it needs
    // `publicService`, the table and the translation table, and every one of them
    // is assigned by the time a request calls this.
    deliveryService:
      definition.delivery.enabled && definition.publicApi.enabled
        ? (c: Context, { pluginId }: { pluginId: string }) =>
            createContentDeliveryService({ c, model, pluginId })
        : undefined,
    // The plugin id arrives at call time rather than being captured here: a
    // revision is stamped with its owner, and `createContentModel` is called
    // from `src/database/*.ts`, which does not otherwise need to know it. Every
    // caller - the generated routes, the queue handler - already carries it,
    // the same way `createContentSearchIndexer` receives it.
    editorialService: definition.editorial.enabled
      ? (c: Context, { pluginId }: { pluginId: string }) =>
          createContentEditorialService({
            advanced,
            c,
            // So publishing the record publishes the languages it has, in the
            // record's own transaction, each through the editorial layer that
            // knows how to give a language a revision and an address. Built here
            // because this is the only place that has both halves; `null` for a
            // content type that has no languages to move.
            cascadeTranslations:
              localized && translationSchemas
                ? async ({ actor, itemId, operation, tx }) => {
                    const translations = buildTranslations(c);
                    const editorial = createContentTranslationEditorialService({
                      c,
                      definition,
                      pluginId,
                      schemas: translationSchemas,
                      translations,
                    });

                    // Read in the caller's transaction, so a language created a
                    // moment ago in the same transaction is moved too.
                    const rows = await translations.findManyForItem(itemId, {
                      tx,
                    });

                    let moved = 0;

                    for (const row of rows) {
                      // A locale the install has switched off is left where it
                      // is on the way *up*: publishing into a language nothing
                      // routes to is refused, and a translation written before
                      // the switch-off must not turn that refusal into "this
                      // record cannot be published at all". Coming back down it
                      // is moved like any other - taking content off a disabled
                      // language is exactly what should still work.
                      const language = await translations.resolveLanguage(
                        row.locale,
                        { requireEnabled: false, tx },
                      );
                      if (operation === "publish" && !language.isEnabled) {
                        continue;
                      }

                      const outcome = await editorial[operation](
                        itemId,
                        row.locale,
                        { actor, tx },
                      );
                      if (outcome?.changed === true) moved += 1;
                    }

                    return moved;
                  }
                : null,
            columns,
            definition,
            pluginId,
            schemas,
            table,
          })
      : undefined,
    localization: definition.localization,
    localizedService: localized
      ? (c: Context, options?: { pluginId?: string }) => {
          const translations = buildTranslations(c);
          const owner = options?.pluginId;

          return createContentLocalizedService({
            c,
            definition,
            // Shares the request's translation model with the editorial layer, so
            // both halves of an atomic create resolve the same language through
            // the same per-request cache.
            //
            // Built only when the caller named the owning plugin: a revision is
            // stamped with its owner, and inventing one would put a wrong value in
            // the column the cleanup job keys off.
            editorial:
              definition.editorial.enabled &&
              translationSchemas &&
              owner !== undefined
                ? createContentTranslationEditorialService({
                    c,
                    definition,
                    pluginId: owner,
                    schemas: translationSchemas,
                    translations,
                  })
                : undefined,
            service: createContentService({
              advanced,
              c,
              columns,
              definition,
              schemas,
              table,
            }),
            translations,
          });
        }
      : undefined,
    // Two implementations behind one name, chosen by the definition rather than
    // by the caller: a route builder is written against `AnyContentTypeDefinition`
    // and has no way to know which it was handed, so the choice has to be made
    // where the answer is a literal.
    publicService: definition.publicApi.enabled
      ? (c: Context) =>
          localized && translationTable && translationColumns
            ? createContentLocalizedPublicService({
                advanced,
                c,
                columns,
                definition,
                table,
                translationColumns,
                translationTable,
              })
            : createContentPublicService({
                advanced,
                c,
                columns,
                definition,
                table,
              })
      : undefined,
    schemas,
    service: (c: Context) =>
      createContentService({
        advanced,
        c,
        columns,
        definition,
        schemas,
        table,
      }),
    table,
    translationColumns,
    translationSchemas,
    // Both flags, because the layer needs both halves: localization gives it a
    // table to write and `editorial` gives it a history to write to. A localized
    // content type without `editorial` keeps the plain repository and nothing else.
    translationEditorialService:
      localized && definition.editorial.enabled && translationSchemas
        ? (c: Context, { pluginId }: { pluginId: string }) =>
            createContentTranslationEditorialService({
              c,
              definition,
              pluginId,
              schemas: translationSchemas,
              translations: buildTranslations(c),
            })
        : undefined,
    translationService: localized ? buildTranslations : undefined,
    translationTable,
  };

  return model;
};
