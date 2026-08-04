import type { Context } from "hono";

import type { AnyContentTypeDefinition } from "../types";

import {
  contentSearchDocumentId,
  contentSearchIndexedFieldNames,
} from "../search";
import { contentSearchDocument, isContentRowPublic } from "./search-document";

/** Which mutation just returned. Not an event name: nothing is emitted here. */
export type ContentSearchOperation =
  "create" | "delete" | "publish" | "unpublish" | "update";

export interface ContentSearchSyncInput {
  /**
   * `publish` / `unpublish` only: `false` when the record was already in the
   * requested state, which means the index already agrees and there is nothing
   * to do.
   */
  changed?: boolean;
  /** `update` only. An update that touched no indexed field changes no document. */
  changedFields?: readonly string[];
  operation: ContentSearchOperation;
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

  // `update` cannot change `status`, so a draft stays a draft and a published
  // record stays published. Nothing to delete, and nothing to write unless a
  // field the document is built from actually moved.
  if (!isPublic) return "skip";

  const indexed = new Set(contentSearchIndexedFieldNames(definition));

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
    decided === "upsert" ? contentSearchDocument(definition, input.row) : null;
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
    await c.get("log").error(
      `[content-search] ${JSON.stringify({
        action,
        contentTypeId: definition.id,
        documentId,
        error: error.message,
        itemId,
        itemType: definition.id,
        operation: input.operation,
      })}`,
    );

    return { action, documentId, error };
  }
};
