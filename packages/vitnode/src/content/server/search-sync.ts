import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { eq } from "drizzle-orm";

import type { AnyContentTypeDefinition } from "../types";
import type { AnyContentModel } from "./model";

import { partitionContentFields } from "../localization";
import { contentColumnsToValues, contentStorageColumns } from "../paths";
import {
  contentSearchDocumentId,
  contentSearchIndexedCollections,
  contentSearchIndexedPaths,
} from "../search";
import { listContentLanguages } from "./language-resolver";
import {
  contentSearchDocument,
  contentTranslationSearchDocument,
  isContentRowPublic,
} from "./search-document";

/** Which mutation just returned. Not an event name: nothing is emitted here. */
export type ContentSearchOperation =
  "create" | "delete" | "publish" | "restore" | "unpublish" | "update";

export interface ContentSearchSyncInput {
  /**
   * The record's advanced collections, when the content type indexes one.
   *
   * Passed in rather than loaded here, because this function is deliberately
   * model-free: it takes a definition and a row. The effects layer already holds
   * the model and reads them once, after commit, only when
   * `contentSearchIndexesCollections` says a document is made of them.
   */
  advanced?: Record<string, unknown>;
  /**
   * `publish` / `unpublish` only: `false` when the record was already in the
   * requested state, which means the index already agrees and there is nothing
   * to do.
   */
  changed?: boolean;
  /**
   * `update` and `restore` only. A write that touched no indexed field changes
   * no document.
   */
  changedFields?: readonly string[];
  operation: ContentSearchOperation;
  /**
   * The plugin that owns the content type. Stamped on the document so a rebuild
   * reproduces the same ownership; omit it and the request's plugin is used,
   * which is only correct while the request belongs to the owner.
   */
  pluginId?: string;
  /** The full row the mutation returned, including `status` and `publishedAt`. */
  row: object;
}

export interface ContentSearchSyncOutcome {
  action: "delete" | "skip" | "upsert";
  /** `"example.article:7"` - for logs and diagnostics, never a storage key. */
  documentId: string;
  /** Set when the search engine threw. The mutation itself still succeeded. */
  error?: Error;
}

/** What the row is, and what the index therefore has to hold. */
const decide = (
  definition: AnyContentTypeDefinition,
  { changed, changedFields, operation, row }: ContentSearchSyncInput,
  isPublic: boolean,
): "delete" | "skip" | "upsert" => {
  const values = row as Record<string, unknown>;

  if (operation === "delete") {
    // `publishedAt` survives an unpublish, so this covers both "currently
    // published" and "was published, is a draft now" - and skips a record that
    // was never published, which was never indexed.
    return values.publishedAt === null || values.publishedAt === undefined
      ? "skip"
      : "delete";
  }

  if (operation === "unpublish") return changed === true ? "delete" : "skip";

  // An idempotent publish is a no-op for the same reason it emits no event:
  // the document is already there and would be rewritten byte for byte.
  if (operation === "publish") {
    return changed === true && isPublic ? "upsert" : "skip";
  }

  if (operation === "create") return isPublic ? "upsert" : "skip";

  // `update` and `restore` both write field values and neither can change
  // `status` - a restore projects only declared fields, and the publication
  // columns are not among them. So a draft stays a draft and a published record
  // stays published: nothing to delete, and nothing to write unless a field the
  // document is built from actually moved. A slug change is covered, because
  // the exposed slug is one of the indexed field names.
  if (!isPublic) return "skip";

  const indexed = contentSearchIndexedPaths(definition);

  return (changedFields ?? []).some(name => indexed.has(name))
    ? "upsert"
    : "skip";
};

/**
 * Brings the search index in line with one content mutation.
 *
 * **Call it only once the database write has returned - never inside a
 * transaction callback.** A rolled-back transaction would leave a document
 * pointing at a record that does not exist, and the search index is not part of
 * the transaction that could undo it. This is the same rule the Next cache
 * invalidation follows, for the same reason.
 *
 * The generated admin routes call it for you. A direct `service.publish(id)`
 * call does not, deliberately: it may be running inside a caller-provided
 * transaction. Application code opts in explicitly, after commit:
 *
 * ```ts
 * const result = await model.service(c).publish(id);
 * if (result) {
 *   await syncContentSearch(c, articleContentType, {
 *     operation: "publish",
 *     changed: result.changed,
 *     row: result.row,
 *   });
 * }
 * ```
 *
 * A failing search engine never turns a successful write into a failed one. The
 * error is logged with enough context to find the record, the outcome carries it
 * for a caller that wants it, and a manual rebuild repairs the drift. That makes
 * the index eventually consistent, with "eventually" bounded by the next publish
 * or the next rebuild.
 */
export const syncContentSearch = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  input: ContentSearchSyncInput,
): Promise<ContentSearchSyncOutcome> => {
  const values = input.row as Record<string, unknown>;
  const itemId = typeof values.id === "number" ? values.id : 0;
  const documentId = contentSearchDocumentId(definition, itemId);

  if (!definition.search.enabled || itemId === 0) {
    return { action: "skip", documentId };
  }

  const decided = decide(definition, input, isContentRowPublic(input.row));
  if (decided === "skip") return { action: decided, documentId };

  // A publicly visible row the mapper will not build - a title that is only
  // whitespace, say - has its document removed rather than left holding whatever
  // text it was indexed with last time.
  const document =
    decided === "upsert"
      ? contentSearchDocument(
          definition,
          { ...input.row, ...input.advanced },
          { pluginId: input.pluginId },
        )
      : null;
  const action = decided === "upsert" && !document ? "delete" : decided;

  try {
    if (document) {
      await c.get("search").index(document);
    } else {
      await c.get("search").delete(definition.id, itemId);
    }

    return { action, documentId };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));

    // `c.get("log")` takes a string, so the context goes in as JSON behind a
    // greppable prefix. The logger middleware adds the plugin id, path, method,
    // user and timestamp on its way into `core_logs`.
    const message = `[content-search] ${JSON.stringify({
      action,
      contentTypeId: definition.id,
      documentId,
      error: error.message,
      itemId,
      itemType: definition.id,
      operation: input.operation,
      pluginId: input.pluginId,
    })}`;

    // The logger writes to the database, so it can fail for the same reason the
    // search engine just did. Both are best effort *after* a committed write, and
    // neither may turn it into a failed request - so the fallback is the console,
    // and the outcome keeps the original search error rather than this one.
    try {
      await c.get("log").error(message);
    } catch {
      // eslint-disable-next-line no-console
      console.error(
        `[VitNode] Failed to log content search failure: ${message}`,
      );
    }

    return { action, documentId, error };
  }
};

export interface ContentLocalizedSearchSyncInput {
  /**
   * The record's shared advanced collections, when the content type indexes one.
   *
   * A localized document is built from three sources - the base row, the shared
   * collections and one translation - and every path that builds one has to
   * supply all three or the documents differ. Passed in rather than loaded here
   * for the same reason the non-localized input takes it: this function is
   * model-free by design, and the effects layer already holds the model.
   *
   * A collection is shared, so the same values feed **every** locale's document.
   */
  advanced?: Record<string, unknown>;
  /**
   * `publish` / `unpublish` only: `false` when nothing moved, which means the
   * index already agrees.
   */
  changed?: boolean;
  /**
   * `update` and `restore` only. A write that touched no indexed field changes
   * no document, in any language.
   */
  changedFields?: readonly string[];
  /**
   * One locale, for a mutation that touched one translation.
   *
   * Omitted for a mutation of the *record* - publishing it, editing a shared
   * field - which changes every language's document at once, because every one of
   * them is built from that row.
   *
   * On `delete` it is the difference between "this translation went away" and
   * "the record went away", which is one document against all of them.
   */
  locale?: string;
  operation: ContentSearchOperation;
  pluginId?: string;
  /** The base row the mutation returned, including `status` and `publishedAt`. */
  row: object;
}

/** One translation, as the document builder needs it. */
interface TranslationRecord {
  languageId: number;
  values: Record<string, unknown>;
}

const readTranslations = async (
  c: Context,
  model: AnyContentModel,
  itemId: number,
): Promise<TranslationRecord[]> => {
  const columns: null | Record<string, PgColumn> = model.translationColumns;
  const table: null | PgTable = model.translationTable;
  if (!columns || !table) return [];

  const { localizedFields } = partitionContentFields(model.definition.fields);
  // Flattened, so a localized group is selected as its leaf columns - and then
  // folded back below, so the document builder sees the same nested shape a
  // public read would.
  const storage = contentStorageColumns(localizedFields);

  const rows = await c
    .get("db")
    .select({
      languageId: columns.languageId,
      publishedAt: columns.publishedAt,
      status: columns.status,
      updatedAt: columns.updatedAt,
      ...Object.fromEntries(
        Object.keys(storage).map(name => [name, columns[name]]),
      ),
    })
    .from(table)
    .where(eq(columns.itemId, itemId));

  return rows.map(row => ({
    languageId: row.languageId as number,
    values: { ...row, ...contentColumnsToValues(localizedFields, row) },
  }));
};

/**
 * Brings the search index in line with one mutation of a **localized** record.
 *
 * One document per published translation, so this is a loop rather than a single
 * decision - and the loop is the point: a record's own publish or unpublish moves
 * every language at once, while a translation's moves exactly one. `locale` is
 * what distinguishes the two, and omitting it on a translation mutation would
 * rewrite every other language's document for nothing.
 *
 * A translation that must not be indexed - a draft, a blank title, a record that
 * is itself a draft - has its document **deleted for that language only**. Taking
 * the Polish copy down must leave the English one exactly where it is, which is
 * why `SearchModel.delete` takes a language.
 *
 * The same rules as the base sync otherwise: call it only after the write has
 * returned, never inside the transaction, and a failing search engine never turns
 * a successful write into a failed one.
 */
export const syncContentLocalizedSearch = async (
  c: Context,
  model: AnyContentModel,
  input: ContentLocalizedSearchSyncInput,
): Promise<ContentSearchSyncOutcome[]> => {
  const { definition } = model;
  const values = input.row as Record<string, unknown>;
  const itemId = typeof values.id === "number" ? values.id : 0;

  if (
    !definition.search.enabled ||
    !definition.localization.enabled ||
    itemId === 0
  ) {
    return [];
  }

  // A delete never enumerates translations: by the time this runs the row it
  // would read is gone. `locale` is the whole difference between the two kinds
  // of delete, and getting it wrong is not a slow path but a wrong one.
  //
  //   locale present  -  one *translation* was deleted  ->  one document
  //   locale absent   -  the *record* was deleted       ->  every document
  //
  // Deleting the Polish translation must leave the English document exactly
  // where it is; omitting the language here would empty the whole record out of
  // the index and only the next rebuild would notice.
  if (input.operation === "delete") {
    const locale = input.locale?.trim();
    const scoped = locale === undefined || locale === "" ? undefined : locale;

    return [
      await write(c, definition, {
        documentId: contentSearchDocumentId(definition, itemId, scoped),
        run: async () => {
          await c.get("search").delete(definition.id, itemId, scoped);
        },
        action: "delete",
        input,
        itemId,
      }),
    ];
  }

  // An idempotent transition is a no-op for the same reason it emits no event:
  // every document is already exactly what it would be rewritten to.
  if (
    (input.operation === "publish" || input.operation === "unpublish") &&
    input.changed !== true
  ) {
    return [];
  }

  // A write that moved no indexed field changes no document. `status` is not a
  // declared field, so a publish never reaches this.
  if (input.operation === "update" || input.operation === "restore") {
    const indexed = contentSearchIndexedPaths(definition);
    const moved = (input.changedFields ?? []).some(name => indexed.has(name));
    if (!moved) return [];
  }

  const languages = await listContentLanguages(c);
  const localeOf = new Map(
    languages.map(language => [language.id, language.locale]),
  );

  const translations = await readTranslations(c, model, itemId);
  const wanted = input.locale?.trim().toLowerCase();

  const outcomes: ContentSearchSyncOutcome[] = [];

  for (const translation of translations) {
    const locale = localeOf.get(translation.languageId);
    // A translation whose language row has been deleted has no locale to index
    // under. Its document is unreachable rather than wrong, and a rebuild is what
    // removes it - inventing a code here would create a document nothing queries.
    if (locale === undefined) continue;
    if (wanted !== undefined && locale.toLowerCase() !== wanted) continue;

    const document = contentTranslationSearchDocument(
      definition,
      {
        // The shared half of the document: the row *and* its shared
        // collections. Omitting the second would rebuild every locale's
        // document without its repeatable text - so editing one localized leaf
        // would silently drop the FAQ out of the index.
        base: { ...input.row, ...input.advanced },
        locale,
        translation: translation.values,
      },
      { pluginId: input.pluginId },
    );

    outcomes.push(
      await write(c, definition, {
        action: document ? "upsert" : "delete",
        documentId: contentSearchDocumentId(definition, itemId, locale),
        input,
        itemId,
        run: async () => {
          if (document) {
            await c.get("search").index(document);

            return;
          }

          // Scoped to this language: unpublishing the Polish copy must leave the
          // English document exactly where it is.
          await c.get("search").delete(definition.id, itemId, locale);
        },
      }),
    );
  }

  return outcomes;
};

/**
 * The shared collections a search document needs, or `undefined`.
 *
 * The one place the "does this document depend on collection values" question is
 * asked, so the live path, the translation path and the base editorial path
 * cannot answer it differently - which is exactly how two of them ended up
 * writing documents the third would not reproduce.
 *
 * Loads **only** the indexed collections. A content type that indexes none -
 * every Stage 1-5 one - costs a boolean check and no query.
 */
export const contentSearchAdvancedValues = async (
  c: Context,
  model: AnyContentModel,
  itemId: number,
): Promise<Record<string, unknown> | undefined> => {
  const wanted = contentSearchIndexedCollections(model.definition);
  if (wanted.length === 0 || itemId === 0) return undefined;

  return await model.service(c).advancedFields(itemId, wanted);
};

/**
 * Runs one index write and turns a failure into an outcome rather than a throw.
 *
 * Shared by the localized paths so the "log it, keep the error, never fail the
 * mutation" rule is stated once - it is the same rule `syncContentSearch` follows
 * for the non-localized case, and a second copy of it would be the one that
 * eventually throws.
 */
const write = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  {
    action,
    documentId,
    input,
    itemId,
    run,
  }: {
    action: "delete" | "upsert";
    documentId: string;
    input: { operation: ContentSearchOperation; pluginId?: string };
    itemId: number;
    run: () => Promise<void>;
  },
): Promise<ContentSearchSyncOutcome> => {
  try {
    await run();

    return { action, documentId };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));

    const message = `[content-search] ${JSON.stringify({
      action,
      contentTypeId: definition.id,
      documentId,
      error: error.message,
      itemId,
      itemType: definition.id,
      operation: input.operation,
      pluginId: input.pluginId,
    })}`;

    try {
      await c.get("log").error(message);
    } catch {
      // eslint-disable-next-line no-console
      console.error(
        `[VitNode] Failed to log content search failure: ${message}`,
      );
    }

    return { action, documentId, error };
  }
};
