import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { QueueModel } from "../../api/models/queue";
import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";
import type { AnyContentModel } from "./model";
import type { RegisteredContentModel } from "./model";
import type { ContentSearchContext } from "./search-document";

import { searchItemIdFromKey } from "../../api/models/search";
import { core_search_index } from "../../database/search";
import { contentContainerFieldOf } from "../containers/association";
import { parseContentId } from "../ids";
import { partitionContentFields } from "../localization";
import { contentColumnsToValues, contentStorageColumns } from "../paths";
import {
  contentSearchContextSource,
  contentSearchDocumentId,
  contentSearchIndexedCollections,
  contentSearchIndexedPaths,
} from "../search";
import { listContentLanguages } from "./language-resolver";
import { contentLocaleRouting } from "./locale-routing";
import { contentDefinitionOf, findContentModel } from "./model";
import {
  contentSearchDocument,
  contentTranslationSearchDocument,
} from "./search-document";
import { createContentSearchIndexer } from "./search-indexer";
import {
  contentSearchContextKey,
  loadContentSearchContexts,
  loadRelatedSearchContext,
  toContainerSearchContext,
  toRelatedSearchContext,
} from "./search-related";

/** Which mutation just returned. Not an event name: nothing is emitted here. */
export type ContentSearchOperation =
  | "create"
  | "delete"
  | "hide"
  | "publish"
  | "restore"
  | "unhide"
  | "unpublish"
  | "update";

const isReachabilityOperation = (operation: ContentSearchOperation): boolean =>
  operation === "publish" ||
  operation === "unpublish" ||
  operation === "hide" ||
  operation === "unhide";

/** What {@link syncContentSearch} needs to know about one committed write. */
export interface ContentSearchSyncInput {
  /** The record's advanced collection values, when the search document includes any. */
  advanced?: Record<string, unknown>;

  /** `publish`, `unpublish`, `hide` and `unhide` only: `false` when nothing moved. */
  changed?: boolean;
  /**
   * `update` and `restore` only. A write that touched no indexed field changes
   * no document.
   */
  changedFields?: readonly string[];
  operation: ContentSearchOperation;

  pluginId?: string;
  /** The full row the mutation returned, including `status` and `publishedAt`. */
  row: object;
}

/** What the sync did to the record's search document. */
export interface ContentSearchSyncOutcome {
  action: "delete" | "skip" | "upsert";
  /** `"example.article:7"` - for logs and diagnostics, never a storage key. */
  documentId: string;
  /** Set when the search engine threw. The mutation itself still succeeded. */
  error?: Error;
}

/**
 * The fields that decide which access scopes a record is filed in: its
 * container and its `access.from` relation. A change to one has to re-stamp
 * the record's search document, and its dependents', even when nothing
 * visible in them moved.
 */
const accessFieldsOf = (definition: AnyContentTypeDefinition): string[] =>
  [definition.access?.from, contentContainerFieldOf(definition)?.name].filter(
    (name): name is string => typeof name === "string",
  );

/** What the row is, and what the index therefore has to hold. */
const decide = (
  definition: AnyContentTypeDefinition,
  { changed, changedFields, operation }: ContentSearchSyncInput,
): "delete" | "skip" | "upsert" => {
  if (operation === "delete") return "delete";

  // An idempotent transition is a no-op for the same reason it emits no event:
  // the document is already there and would be rewritten byte for byte.
  if (isReachabilityOperation(operation)) {
    return changed === true ? "upsert" : "skip";
  }

  if (operation === "create") return "upsert";

  // `update` and `restore` both write field values and neither can change
  // `status` - a restore projects only declared fields, and the publication
  // columns are not among them. So nothing to write unless a field the document
  // is built from actually moved. A slug change is covered, because the exposed
  // slug is one of the indexed field names.
  const indexed = contentSearchIndexedPaths(definition);
  const access = accessFieldsOf(definition);

  return (changedFields ?? []).some(
    name => indexed.has(name) || access.includes(name),
  )
    ? "upsert"
    : "skip";
};

/**
 * Brings one record's search document in line with a committed write on a
 * non-localized content type: deletes it on `delete`, writes it on `create`,
 * on a publication or visibility change that moved something, and on an
 * update or restore that changed an indexed field, and otherwise skips. A row
 * the document builder rejects has its document removed. Skips everything
 * for a type without `search`.
 *
 * Search-engine errors are logged and returned on `error`, never thrown,
 * because the write itself has already committed. Loading the related context
 * reads the database, and that read can still throw. The effects helpers call
 * it for you; call it directly only from a custom write path that does not
 * use them.
 */
export const syncContentSearch = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  input: ContentSearchSyncInput,
): Promise<ContentSearchSyncOutcome> => {
  const values = input.row as Record<string, unknown>;
  const itemId = parseContentId(definition.idStrategy, values.id);
  const documentId = contentSearchDocumentId(definition, itemId ?? 0);

  if (!definition.search.enabled || itemId === null) {
    return { action: "skip", documentId };
  }

  const decided = decide(definition, input);
  if (decided === "skip") return { action: decided, documentId };

  // A row the mapper will not build - a title that is only whitespace, say - has
  // its document removed rather than left holding whatever text it was indexed
  // with last time.
  const contextKey = contentSearchContextKey(definition, values);
  const context =
    decided === "upsert" && contextKey !== null
      ? (await loadContentSearchContexts(c, definition, [values])).get(
          contextKey,
        )
      : undefined;
  const document =
    decided === "upsert"
      ? contentSearchDocument(
          definition,
          { ...input.row, ...input.advanced },
          {
            context,
            pluginId: input.pluginId,
            routing: contentLocaleRouting(c),
          },
        )
      : null;
  const action = decided === "upsert" && !document ? "delete" : decided;

  try {
    if (document) {
      await c.get("search").index(document);
    } else {
      await c.get("search").delete(definition.id, itemId);
    }

    await syncContentSearchDependents(c, definition, {
      documentId,
      input,
      itemId,
    });

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
      // oxlint-disable-next-line no-console
      console.error(
        `[VitNode] Failed to log content search failure: ${message}`,
      );
    }

    return { action, documentId, error };
  }
};

const CONTENT_SEARCH_DEPENDENT_PAGE_SIZE = 200;

/** Deletes in flight at once, so a page of them cannot drain the pool. */
const CONTENT_SEARCH_DELETE_CONCURRENCY = 10;

/** Finishes a dependent reindex too big for the request that started it. */
export const CONTENT_QUEUE_TASK_SEARCH_DEPENDENTS = "content-search-dependents";

export const contentSearchDependentsPayloadSchema = z.object({
  /** The dependent's cursor: the last id the request already reindexed. */
  after: z.union([z.number().int(), z.string().min(1)]),
  /** The record whose title or URL the dependents carry. */
  contentTypeId: z.string().min(1),
  dependentTypeId: z.string().min(1),
  field: z.string().min(1),
  itemId: z.union([z.number().int(), z.string().min(1)]),
});

type ContentSearchDependentsPayload = z.infer<
  typeof contentSearchDependentsPayloadSchema
>;

const dependentSyncOf = (
  definition: AnyContentTypeDefinition,
  { changed, changedFields, operation }: ContentSearchSyncInput,
): "delete" | "skip" | "upsert" => {
  if (operation === "delete") return "delete";
  if (operation === "create") return "skip";
  if (isReachabilityOperation(operation)) {
    return changed === true ? "upsert" : "skip";
  }

  const linked = [
    definition.search.titleField,
    definition.publicApi.slugField,
    ...accessFieldsOf(definition),
  ];

  return (changedFields ?? []).some(name => linked.includes(name))
    ? "upsert"
    : "skip";
};

const reindexContentSearchDependent = async (
  c: Context,
  { model, pluginId }: RegisteredContentModel,
  {
    after: start,
    context,
    defer,
    field,
    value,
  }: {
    after?: ContentId;
    context: ContentSearchContext;
    /**
     * Hands the rest to the queue once the first page is written. Without it the
     * whole relation is walked here.
     */
    defer?: (after: ContentId) => Promise<void>;
    field: string;
    value: ContentId;
  },
): Promise<void> => {
  const dependent = contentDefinitionOf(model);
  const indexer = createContentSearchIndexer(model, { pluginId });
  let after = start;

  for (;;) {
    const page = await indexer.loadByRelation(c, {
      after,
      context,
      field,
      limit: CONTENT_SEARCH_DEPENDENT_PAGE_SIZE,
      value,
    });

    if (page.documents.length > 0) {
      await c.get("search").bulkIndex(page.documents);
    }
    for (
      let index = 0;
      index < page.unindexed.length;
      index += CONTENT_SEARCH_DELETE_CONCURRENCY
    ) {
      await Promise.all(
        page.unindexed
          .slice(index, index + CONTENT_SEARCH_DELETE_CONCURRENCY)
          .map(async id => await c.get("search").delete(dependent.id, id)),
      );
    }

    const read = page.documents.length + page.unindexed.length;
    if (page.lastId === null || read < CONTENT_SEARCH_DEPENDENT_PAGE_SIZE) {
      return;
    }
    after = page.lastId;

    if (defer) {
      await defer(after);

      return;
    }
  }
};

/**
 * The queue's half of a dependent reindex: the pages after the one the write's
 * own request already wrote.
 *
 * The record is read back rather than carried in the payload, so a title edited
 * again before the queue drains is indexed as it is now, not as it was.
 */
export const runContentSearchDependentsTask = async (
  c: Context,
  payload: ContentSearchDependentsPayload,
): Promise<void> => {
  const models = c.get("core")?.contentModels ?? [];
  const parent = findContentModel(models, payload.contentTypeId);
  const dependent = findContentModel(models, payload.dependentTypeId);
  // A plugin removed since the write: nothing left to index, or to index with.
  if (!parent || !dependent) return;

  const definition = contentDefinitionOf(parent.model);
  const itemId = parseContentId(definition.idStrategy, payload.itemId);
  const after = parseContentId(
    contentDefinitionOf(dependent.model).idStrategy,
    payload.after,
  );
  if (itemId === null || after === null) return;

  // Deleted since: its delete already removed every dependent's document.
  const row = await parent.model.service(c).findById(itemId);
  if (!row) return;

  await reindexContentSearchDependent(c, dependent, {
    after,
    context:
      (await loadRelatedSearchContext(c, definition, itemId)) ??
      toRelatedSearchContext(definition, row, contentLocaleRouting(c)),
    field: payload.field,
    value: itemId,
  });
};

const syncContentSearchDependents = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  {
    documentId,
    input,
    itemId,
  }: { documentId: string; input: ContentSearchSyncInput; itemId: ContentId },
): Promise<void> => {
  const sync = dependentSyncOf(definition, input);
  if (sync === "skip") return;

  const dependents = (c.get("core")?.contentModels ?? []).flatMap(entry => {
    const source = contentSearchContextSource(contentDefinitionOf(entry.model));

    return source?.kind === "relation" && source.target.id === definition.id
      ? [{ entry, field: source.field }]
      : [];
  });
  if (dependents.length === 0) return;

  await write(c, definition, {
    action: sync,
    documentId,
    input,
    itemId,
    run: async () => {
      const context =
        sync === "delete"
          ? undefined
          : ((await loadRelatedSearchContext(c, definition, itemId)) ??
            toRelatedSearchContext(
              definition,
              input.row,
              contentLocaleRouting(c),
            ));

      for (const { entry, field } of dependents) {
        const dependent = contentDefinitionOf(entry.model);

        if (sync === "delete") {
          if (typeof itemId === "number") {
            await c.get("search").deleteByContainer({
              containerId: itemId,
              containerType: definition.id,
              itemType: dependent.id,
            });
          }
          continue;
        }
        if (!context) continue;

        // Absent outside a full request - a test, a script - which keeps the
        // whole walk inline.
        const queue: QueueModel | undefined = c.get("queue");

        // The first page is written here, so a record with a handful of
        // comments is consistent the moment the edit returns. Thousands of them
        // are the queue's job, not the editor's request.
        await reindexContentSearchDependent(c, entry, {
          context,
          ...(queue
            ? {
                defer: async after => {
                  await queue.dispatch({
                    name: CONTENT_QUEUE_TASK_SEARCH_DEPENDENTS,
                    payload: {
                      after,
                      contentTypeId: definition.id,
                      dependentTypeId: dependent.id,
                      field,
                      itemId,
                    } satisfies ContentSearchDependentsPayload,
                    // Core owns the handler, whichever plugin's request this is.
                    pluginId: "@vitnode/core",
                  });
                },
              }
            : {}),
          field,
          value: itemId,
        });
      }
    },
  });
};

export const syncContentSearchContainerDependents = async (
  c: Context,
  {
    container,
    containerType,
  }: {
    container: { id: number; name: string; slug: string };
    containerType: string;
  },
): Promise<void> => {
  for (const entry of c.get("core")?.contentModels ?? []) {
    const definition = contentDefinitionOf(entry.model);
    const source = contentSearchContextSource(definition);
    if (
      source?.kind !== "container" ||
      source.containerType !== containerType
    ) {
      continue;
    }

    await write(c, definition, {
      action: "upsert",
      documentId: `${containerType}:${container.id}`,
      input: { operation: "update", pluginId: entry.pluginId },
      itemId: container.id,
      run: async () => {
        await reindexContentSearchDependent(c, entry, {
          context: toContainerSearchContext(
            source,
            container,
            contentLocaleRouting(c),
          ),
          field: source.field,
          value: container.id,
        });
      },
    });
  }
};

/** {@link ContentSearchSyncInput} for a localized content type. */
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
  itemId: ContentId,
): Promise<TranslationRecord[]> => {
  const columns: null | Record<string, PgColumn> = model.translationColumns;
  const table: null | PgTable = model.translationTable;
  if (!columns || !table) return [];

  const { localizedFields } = partitionContentFields(
    contentDefinitionOf(model).fields,
  );
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
 * One document per translation, so this is a loop rather than a single
 * decision - and the loop is the point: a record's own publish or unpublish moves
 * every language at once, while a translation's moves exactly one. `locale` is
 * what distinguishes the two, and omitting it on a translation mutation would
 * rewrite every other language's document for nothing.
 *
 * A draft translation, or one whose record is a draft, stays in the index as a
 * private document. A translation that cannot be indexed - a blank title - has
 * its document **deleted for that language only**. Taking the Polish copy down
 * must leave the English one exactly where it is, which is why
 * `SearchModel.delete` takes a language.
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
  const definition = contentDefinitionOf(model);
  const values = input.row as Record<string, unknown>;
  const itemId = parseContentId(definition.idStrategy, values.id);

  if (
    !definition.search.enabled ||
    !definition.localization.enabled ||
    itemId === null
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
  if (isReachabilityOperation(input.operation) && input.changed !== true) {
    return [];
  }

  // A write that moved no indexed field changes no document. `status` is not a
  // declared field, so a publish never reaches this.
  if (input.operation === "update" || input.operation === "restore") {
    const indexed = contentSearchIndexedPaths(definition);
    const access = accessFieldsOf(definition);
    const moved = (input.changedFields ?? []).some(
      name => indexed.has(name) || access.includes(name),
    );
    if (!moved) return [];
  }

  const languages = await listContentLanguages(c);
  const localeOf = new Map(
    languages.map(language => [language.id, language.locale]),
  );

  const translations = await readTranslations(c, model, itemId);
  const wanted = input.locale?.trim().toLowerCase();

  const planned = translations.flatMap(translation => {
    const locale = localeOf.get(translation.languageId);
    // A translation whose language row has been deleted has no locale to index
    // under. Its document is unreachable rather than wrong, and a rebuild is what
    // removes it - inventing a code here would create a document nothing queries.
    if (locale === undefined) return [];
    if (wanted !== undefined && locale.toLowerCase() !== wanted) return [];

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
      { pluginId: input.pluginId, routing: contentLocaleRouting(c) },
    );

    return [{ document, locale }];
  });

  const documents = planned.flatMap(({ document }) =>
    document ? [document] : [],
  );
  // One write for every language at once. Not for a record that hangs off
  // another one: `index` is what notices a new comment and credits its parent,
  // and a bulk write would skip that.
  const batch =
    documents.length > 1 &&
    contentSearchContextSource(definition)?.kind !== "relation"
      ? await write(c, definition, {
          action: "upsert",
          documentId: contentSearchDocumentId(definition, itemId),
          input,
          itemId,
          run: async () => {
            await c.get("search").bulkIndex(documents);
          },
        })
      : null;

  const outcomes: ContentSearchSyncOutcome[] = [];

  for (const { document, locale } of planned) {
    const documentId = contentSearchDocumentId(definition, itemId, locale);

    if (document && batch) {
      outcomes.push({
        action: "upsert",
        documentId,
        ...(batch.error ? { error: batch.error } : {}),
      });
      continue;
    }

    outcomes.push(
      await write(c, definition, {
        action: document ? "upsert" : "delete",
        documentId,
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

  if (
    (input.operation === "update" || input.operation === "restore") &&
    (input.changedFields ?? []).some(name =>
      accessFieldsOf(definition).includes(name),
    )
  ) {
    await refreshContentSearchDependentAccess(c, definition, itemId);
  }

  return outcomes;
};

/**
 * Re-stamps the access scopes of every document indexed under one record - a
 * blog article's comments after its categories changed. Reads the index for
 * them rather than every dependent table, and never throws: a failure is
 * logged, the search-time check against the content tables still holds, and
 * the reconciliation job catches up.
 */
export const refreshContentSearchDependentAccess = async (
  c: Context,
  definition: Pick<AnyContentTypeDefinition, "id">,
  itemId: ContentId,
): Promise<void> => {
  if (typeof itemId !== "number") return;

  try {
    const rows = await c
      .get("db")
      .selectDistinct({
        itemId: core_search_index.itemId,
        itemType: core_search_index.itemType,
      })
      .from(core_search_index)
      .where(
        and(
          eq(core_search_index.containerType, definition.id),
          eq(core_search_index.containerId, itemId),
        ),
      );
    const contentTypes = c.get("core")?.contentTypes ?? [];
    await c.get("search").refreshAccessScopes(
      rows.map(row => ({
        itemId: searchItemIdFromKey(contentTypes, row.itemType, row.itemId),
        itemType: row.itemType,
      })),
    );
  } catch (error) {
    await c
      .get("log")
      .error(
        `[content-search] ${definition.id} ${String(itemId)}: dependent access scopes could not be refreshed (${error instanceof Error ? error.message : String(error)}). The reconciliation job will retry.`,
      );
  }
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
  itemId: ContentId,
): Promise<Record<string, unknown> | undefined> => {
  const wanted = contentSearchIndexedCollections(contentDefinitionOf(model));
  if (wanted.length === 0) return undefined;

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
    itemId: ContentId;
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
      // oxlint-disable-next-line no-console
      console.error(
        `[VitNode] Failed to log content search failure: ${message}`,
      );
    }

    return { action, documentId, error };
  }
};
