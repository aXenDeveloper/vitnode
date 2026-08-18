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
  /**
   * The read and write layer for this content type's advanced collections.
   *
   * On the model rather than built per request, because it holds only the
   * resolved tables and the memoised foreign-key targets - every method takes
   * the database handle it should run on. A disabled stub for a content type
   * that declares no collection, so a caller can use it unconditionally.
   *
   * Public so the rebuild indexers can batch-load a page's collections: they are
   * built from the model and have no service of their own.
   */
  advanced: ContentAdvancedStore;
  /**
   * The generated collection tables, by field name.
   *
   * Export them from the plugin's database module alongside `table`, so Drizzle
   * Kit finds them and the migration is generated:
   *
   * ```ts
   * export const example_articles_categories =
   *   articleContent.advancedTables.junctions.categories;
   * ```
   *
   * Empty for a content type that declares no advanced collection.
   */
  advancedTables: ContentAdvancedTables;
  /** Column name -> Drizzle column, for filters, ordering and custom queries. */
  columns: Record<ContentColumnName<TDefinition>, PgColumn>;
  definition: TDefinition;
  /**
   * The read-only delivery layer, or `undefined` without a `delivery` block.
   *
   * `undefined` rather than a throwing stub, matching `publicService` and
   * `editorialService`: the check reads naturally in code that does not know which
   * content type it was handed, and TypeScript refuses the call until it has been
   * made.
   *
   * `options.pluginId` is required because slug history is stamped with its owner -
   * the same reason `editorialService` takes one, and `createContentModel` is
   * called from `src/database/*.ts`, which has no reason to know it.
   */
  deliveryService:
    | ((c: Context, options: { pluginId: string }) => ContentDeliveryService)
    | undefined;
  /**
   * The transactional editorial repository, or `undefined` when the content
   * type has no `editorial` block.
   *
   * `undefined` rather than a throwing stub, for the same reason
   * `publicService` is: the check reads naturally in a route builder that has
   * no idea which content type it was handed.
   */
  editorialService:
    | ((
        c: Context,
        options: { pluginId: string },
      ) => ContentEditorialService<TDefinition>)
    | undefined;
  /**
   * The resolved localization config, mirrored off the definition.
   *
   * Present on every model, so `model.localization.enabled` is the one flag route
   * builders and background work branch on - without reaching through
   * `definition` for it.
   */
  localization: ResolvedContentLocalizationConfig;
  /**
   * Creates a base row and its default translation in one transaction, or
   * `undefined` when the content type is not localized.
   *
   * `options.pluginId` is optional and additive: supply it on an editorial content
   * type and the default translation gets its own `create` revision, stamped with
   * the right owner. Omit it - as every Stage 5A caller does - and the translation
   * is written through the plain repository exactly as before.
   */
  localizedService:
    | ((
        c: Context,
        options?: { pluginId?: string },
      ) => ContentLocalizedService<TDefinition>)
    | undefined;
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
  /**
   * Column name -> Drizzle column on the translation table, or `null` when the
   * content type is not localized.
   */
  translationColumns: null | Record<
    ContentTranslationColumnName<TDefinition>,
    PgColumn
  >;
  /**
   * The transactional translation editorial layer, or `undefined` unless the
   * content type is **both** localized and editorial.
   *
   * `undefined` rather than a throwing stub, matching every other optional member
   * here: the check reads naturally in code that does not know which content type
   * it was handed, and TypeScript refuses the call until it has been made.
   */
  translationEditorialService:
    | ((
        c: Context,
        options: { pluginId: string },
      ) => ContentTranslationEditorialService<TDefinition>)
    | undefined;
  /** The per-language schemas, or `null`. Mirrored off `schemas.translation`. */
  translationSchemas: ContentTranslationSchemas<TDefinition> | null;
  /**
   * The translation repository, or `undefined` when the content type is not
   * localized. Emits nothing and invalidates nothing - see
   * {@link ContentTranslationModel}.
   */
  translationService:
    ((c: Context) => ContentTranslationModel<TDefinition>) | undefined;
  /**
   * The generated translation `pgTable`, or `null`. Export it alongside `table`
   * so Drizzle Kit finds it and the migration is generated:
   *
   * ```ts
   * export const example_articles = articleContent.table;
   * export const example_articles_translations = articleContent.translationTable;
   * ```
   */
  translationTable: ContentTranslationTableFor<TDefinition> | null;
}

/**
 * Any content model, for code that holds a collection of them.
 *
 * The same shape `AnyContentTypeDefinition` provides for definitions, and it
 * exists for the same reason: background work - the scheduled-publication task,
 * the cleanup cron - looks a model up by content type id and cannot know which
 * concrete one it will get.
 */
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

/**
 * One erased model's definition, read back with its real type.
 *
 * `AnyContentModel` erases the whole parameter, so `model.definition` comes out
 * as `any`. Everything that reads it - the id, the fields, the localization
 * block - wants the ordinary type, and passing `any` straight into those calls
 * would spread untyped values well past this boundary. Narrowing it here keeps
 * the erasure confined to the members that need it.
 *
 * A plain annotation rather than an override on `AnyContentModel`: adding any
 * member to that alias turns it into a distinct type, and TypeScript then
 * structurally compares a concrete `ContentModel<T>` against it - which is the
 * comparison the erasure exists to avoid.
 */
export const contentDefinitionOf = (
  model: AnyContentModel,
): AnyContentTypeDefinition => model.definition as AnyContentTypeDefinition;

/**
 * A model plus the plugin that registered it.
 *
 * The owner is not on the model itself because `createContentModel` is called
 * from `src/database/<entity>.ts`, which has no reason to know it. It is
 * attached here, at collection time, where `buildApiPlugin` already knows.
 */
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

  /**
   * One translation model per call, bound to the request's handle.
   *
   * Built here rather than inside each service so `localizedService` and
   * `translationService` share the same instance for one request - and so the
   * "localization is enabled" narrowing happens exactly once.
   */
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
