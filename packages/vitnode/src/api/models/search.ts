import type { Context } from "hono";

import { and, eq, inArray } from "drizzle-orm";

import { core_search_index } from "@/database/search";
import { core_users } from "@/database/users";
import { stripHtml } from "@/lib/strip-html";

export interface SearchDocument {
  authorId?: null | number;
  containerId?: number;
  containerType?: string;
  content: string;
  createdAt: Date;
  isPublic?: boolean;
  itemId: number;
  itemType: string;
  // Locale of this projection. Multi-language content emits one document per
  // language; single-language content may leave it empty.
  languageCode?: string;
  metadata?: Record<string, unknown>;
  // The plugin that owns this item. Omit it and {@link SearchModel} falls back
  // to the request's plugin - which is only right while the request *is* the
  // owning plugin's, so a rebuild (it runs in the core cron request) must set it
  // explicitly.
  pluginId?: string;
  title: string;
  updatedAt?: Date;
  url?: string;
}

export interface SearchQueryParams {
  authorId?: number;
  containerId?: number;
  cursor?: string;
  dateFrom?: Date;
  dateTo?: Date;
  first?: number;
  includePrivate?: boolean;
  itemTypes?: string[];
  // Restrict results to one locale (the viewer's). Rows with an empty
  // `languageCode` (language-agnostic content) always match.
  languageCode?: string;
  sort?: "newest" | "oldest" | "relevance";
  term?: string;
}

export interface SearchHitAuthor {
  avatarColor: string;
  id: number;
  name: string;
  nameCode: string;
}

export interface SearchHit {
  author: null | SearchHitAuthor;
  authorId: null | number;
  containerId: null | number;
  containerType: null | string;
  content: string;
  createdAt: Date;
  id: number;
  itemId: number;
  itemType: string;
  languageCode: string;
  metadata: Record<string, unknown>;
  pluginId: string;
  score: null | number;
  title: string;
  url: null | string;
}

export interface SearchPageInfo {
  count: number;
  endCursor: null | number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: null | number;
  totalCount: number;
}

export interface SearchResult {
  edges: SearchHit[];
  pageInfo: SearchPageInfo;
}

export interface SearchProviderCapabilities {
  authorBoost: boolean;
  /**
   * Whether the provider's store **is** `core_search_index`.
   *
   * True only for the bundled Postgres provider, which queries the canonical
   * table directly rather than mirroring it. Diagnostics use this to skip a
   * second count of the same rows: canonical and provider are one storage, so
   * asking twice would cost a query to learn something already known.
   *
   * A mirroring provider - anything with its own store - must leave it unset.
   */
  canonicalStorage?: boolean;
  facets: boolean;
  /**
   * Whether {@link SearchProviderApiPlugin.delete} honours its `languageCode`.
   *
   * Declared rather than inferred, because JavaScript cannot tell the difference:
   * a provider written as `delete(c, itemType, itemId)` accepts the fourth
   * argument at runtime and silently ignores it, so taking down one translation
   * would remove every language from that provider's store while the canonical
   * `core_search_index` removed one. The two would then disagree forever, and
   * nothing would say so.
   *
   * Optional, so a provider written before localized content still compiles and
   * still serves single-language content. Absent means "no", and
   * {@link assertSearchProviderCapabilities} refuses to boot an install that
   * pairs such a provider with a localized searchable content type.
   */
  languageScopedDelete?: boolean;
  timeDecay: boolean;
}

/**
 * One page of a rebuild.
 *
 * The two counts are separate on purpose. An indexer may emit several documents
 * per item (one per language, say) or none at all (a row whose data cannot be
 * projected), so a document count can never stand in for a source count - using
 * it would either skip items or end the rebuild while rows remain.
 */
export interface SearchIndexerPage {
  documents: SearchDocument[];
  /** Source rows this page read. `0` means the source is exhausted. */
  itemsRead: number;
}

/**
 * The pre-{@link SearchIndexerPage} result: documents with no source count.
 *
 * @deprecated Return a {@link SearchIndexerPage}. An array cannot say how many
 * source rows produced it, so the rebuild has to assume a full page was read and
 * wait for an empty one to stop - which means a page that reads rows and projects
 * none of them (every row on it malformed, say) ends the rebuild early and the
 * rows behind it are never indexed. Supported for now; removed in a future major
 * release.
 */
export type LegacySearchIndexerPage = SearchDocument[];

export type SearchIndexerLoadResult =
  // The one intentional use of the deprecated shape: this union is what keeps
  // pre-Stage-3 indexers compiling, so the lint rule has nothing to warn about
  // here. Every *other* reference should be flagged.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  LegacySearchIndexerPage | SearchIndexerPage;

/**
 * Streams every existing item of one content type so the whole index can be
 * rebuilt (e.g. after switching engines).
 *
 * `load` is called with `offset` advanced by the previous page's `itemsRead`.
 * Report `itemsRead: 0` to end the rebuild; an empty `documents` array does not,
 * because a page can legitimately read rows and project none of them.
 *
 * Returning a bare `SearchDocument[]` still works - see
 * {@link LegacySearchIndexerPage} for what it gives up.
 */
export interface SearchIndexer {
  // Total number of source items available to index for this type. Powers the
  // admin coverage report (indexed vs. total). Omit when the source count is
  // unknown or expensive; coverage then falls back to the indexed count (100%).
  count?: (c: Context) => Promise<number>;
  itemType: string;
  load: (
    c: Context,
    offset: number,
    limit: number,
  ) => Promise<SearchIndexerLoadResult>;
}

/**
 * A declared document owner, or `undefined` when there is not really one.
 *
 * `pluginId` is public input, so an empty or whitespace-only string is a missing
 * owner rather than a collection named `""`. Every place that resolves ownership
 * goes through this, so the fallback chains cannot drift apart.
 */
export const searchDocumentOwner = (
  pluginId: null | string | undefined,
): string | undefined => {
  const trimmed = pluginId?.trim();

  return trimmed === "" ? undefined : trimmed;
};

/**
 * Turns either `load` result into a page, so the rebuild has one shape to reason
 * about and the compatibility rule lives in exactly one place.
 *
 * A non-empty legacy array reports `requestedLimit` rather than
 * `documents.length`, because that is what the old rebuild advanced by: an
 * indexer may emit several documents per source row (one per language), so a
 * document count would skip rows on every page. An empty array is the only end
 * signal it has.
 */
export const normalizeSearchIndexerPage = (
  result: SearchIndexerLoadResult,
  requestedLimit: number,
): SearchIndexerPage => {
  if (!Array.isArray(result)) return result;

  return {
    documents: result,
    itemsRead: result.length === 0 ? 0 : requestedLimit,
  };
};

export interface SearchIndexerConfig extends SearchIndexer {
  pluginId: string;
}

/**
 * Rejects two indexers claiming the same `itemType`.
 *
 * `itemType` is the index's only namespace, so a collision is not a cosmetic
 * problem: both indexers would `load` on every rebuild, writing over each
 * other's documents whenever their item ids overlap, and the admin coverage
 * report would silently describe only the first one. Failing at boot is the only
 * place this is cheap to notice.
 *
 * Called once per plugin by `buildApiPlugin` and again across every plugin by
 * the global middleware, which is the only place that sees them all.
 */
export const validateSearchIndexers = (
  indexers: readonly SearchIndexerConfig[],
): SearchIndexerConfig[] => {
  const seen = new Map<string, string>();

  for (const indexer of indexers) {
    const owner = seen.get(indexer.itemType);
    if (owner !== undefined) {
      throw new Error(
        `[Search] Duplicate search indexer for item type "${indexer.itemType}": registered by both "${owner}" and "${indexer.pluginId}". An item type may only be indexed by one indexer.`,
      );
    }

    seen.set(indexer.itemType, indexer.pluginId);
  }

  return [...indexers];
};

/**
 * Refuses to boot a provider that cannot express what the installed content
 * types need.
 *
 * Only one requirement so far, and it is narrow on purpose: a content type that
 * is both localized and searchable is indexed once per published translation, so
 * unpublishing or deleting one of them has to remove exactly one document. A
 * provider that ignores `languageCode` would take every language out instead, and
 * because the extra argument is simply dropped there is no error, no log line and
 * no way to notice until somebody searches for content that should still be
 * there.
 *
 * Fails at boot rather than at the delete for the obvious reason: the delete is
 * the moment the damage happens, and by then the install has been running.
 *
 * Content types are passed as plain ids so this stays where the rest of the
 * search contract lives, with no dependency on the Content Engine.
 */
export const assertSearchProviderCapabilities = (
  provider: SearchProviderApiPlugin,
  {
    localizedSearchContentTypes,
  }: {
    /** Ids of content types indexed once per translation. */
    localizedSearchContentTypes: readonly string[];
  },
): void => {
  if (localizedSearchContentTypes.length === 0) return;
  if (provider.capabilities?.languageScopedDelete === true) return;

  throw new Error(
    `[Search] The "${provider.name}" search provider does not support language-scoped deletion, but ${localizedSearchContentTypes.length === 1 ? "the content type" : "the content types"} ${localizedSearchContentTypes
      .map(id => `"${id}"`)
      .join(
        ", ",
      )} ${localizedSearchContentTypes.length === 1 ? "is" : "are"} localized and searchable - each publishes one search document per translation. Taking one translation down must remove one document, and a provider that ignores the "languageCode" argument of "delete" would remove every language instead. Declare "capabilities: { languageScopedDelete: true }" on the provider once its "delete" honours that argument, or turn "search" off for ${localizedSearchContentTypes.length === 1 ? "that content type" : "those content types"}.`,
  );
};

/**
 * A pluggable search engine. The {@link SearchModel} owns the canonical
 * `core_search_index` table for every provider, so a provider that queries that
 * table directly (the bundled Postgres one) implements the mutation methods as
 * no-ops and only `search`. External engines (e.g. Elasticsearch) mirror the
 * mutations into their own store and answer `search` from it.
 */
export interface SearchProviderApiPlugin {
  bulkIndex: (c: Context, docs: SearchDocument[]) => Promise<void>;
  capabilities?: SearchProviderCapabilities;
  clear: (c: Context, itemType?: string) => Promise<void>;
  /**
   * How many documents the provider holds for one collection.
   *
   * Optional, and its absence is meaningful: a provider that cannot be counted
   * is reported as **unverified** rather than healthy, because "we did not look"
   * and "we looked and it was fine" are different answers and only one of them
   * is worth acting on.
   *
   * It must count rather than fetch - `_count` on Elasticsearch, `COUNT(*)` on a
   * table - and honour `languageCode` where the provider stores one document per
   * translation. Omitting the language means every language.
   */
  count?: (
    c: Context,
    args: { itemType: string; languageCode?: string },
  ) => Promise<number>;
  /**
   * Removes one item's documents.
   *
   * `languageCode` narrows it to a single language, for content that is indexed
   * once per translation: unpublishing the Polish copy of an article must not
   * take the English one out of the index. Omit it and every language goes, which
   * is what deleting the record itself means.
   *
   * Optional on the signature so a provider written before per-locale content
   * still compiles - but ignoring it is **not** silently tolerated. A provider
   * that honours it says so with
   * `capabilities: { languageScopedDelete: true }`, and an install that pairs one
   * that does not with a localized searchable content type refuses to boot. See
   * {@link assertSearchProviderCapabilities}.
   */
  delete: (
    c: Context,
    itemType: string,
    itemId: number,
    languageCode?: string,
  ) => Promise<void>;
  index: (c: Context, doc: SearchDocument) => Promise<void>;
  name: string;
  ping?: (c: Context) => Promise<boolean>;
  search: (c: Context, params: SearchQueryParams) => Promise<SearchResult>;
}

const toRow = (doc: SearchDocument) => ({
  pluginId: doc.pluginId ?? "core",
  itemType: doc.itemType,
  itemId: doc.itemId,
  languageCode: doc.languageCode ?? "",
  authorId: doc.authorId ?? null,
  title: doc.title,
  content: doc.content,
  containerType: doc.containerType ?? null,
  containerId: doc.containerId ?? null,
  url: doc.url ?? null,
  isPublic: doc.isPublic ?? true,
  metadata: doc.metadata ?? {},
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt ?? null,
  indexedAt: new Date(),
});

export class SearchModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  // Providers that don't join the users table (e.g. Elasticsearch) return hits
  // with `authorId` but `author: null`; fill in the display fields here.
  private async hydrateAuthors(edges: SearchHit[]): Promise<SearchHit[]> {
    const missing = [
      ...new Set(
        edges.flatMap(edge =>
          !edge.author && edge.authorId ? [edge.authorId] : [],
        ),
      ),
    ];
    if (missing.length === 0) return edges;

    const rows = await this.c
      .get("db")
      .select({
        id: core_users.id,
        name: core_users.name,
        nameCode: core_users.nameCode,
        avatarColor: core_users.avatarColor,
      })
      .from(core_users)
      .where(inArray(core_users.id, missing));

    const byId = new Map(rows.map(row => [row.id, row]));

    return edges.map(edge =>
      edge.author || !edge.authorId
        ? edge
        : { ...edge, author: byId.get(edge.authorId) ?? null },
    );
  }

  private provider(): SearchProviderApiPlugin {
    return this.c.get("core").search.adapter;
  }

  /**
   * Fills in the document's owner, once, for every write path.
   *
   * The request's plugin is only a *fallback*: it is the owner when a mutation
   * route indexes its own content, and it is `@vitnode/core` during a rebuild,
   * which runs inside the core cron request. So an explicit `pluginId` always
   * wins - that is how a rebuild reproduces the same ownership a live write
   * produced. Resolving it here rather than in each adapter is what keeps the
   * canonical row and the mirrored document from disagreeing.
   */
  private resolveOwner(doc: SearchDocument): SearchDocument {
    return {
      ...doc,
      pluginId:
        searchDocumentOwner(doc.pluginId) ?? this.c.get("plugin")?.id ?? "core",
    };
  }

  private async upsertRow(doc: SearchDocument): Promise<void> {
    const row = toRow(doc);

    await this.c
      .get("db")
      .insert(core_search_index)
      .values(row)
      .onConflictDoUpdate({
        target: [
          core_search_index.itemType,
          core_search_index.itemId,
          core_search_index.languageCode,
        ],
        set: {
          // Included so a rebuild corrects the owner of a row written before the
          // indexer declared one, rather than leaving the first writer's guess.
          pluginId: row.pluginId,
          authorId: row.authorId,
          title: row.title,
          content: row.content,
          containerType: row.containerType,
          containerId: row.containerId,
          url: row.url,
          isPublic: row.isPublic,
          metadata: row.metadata,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          indexedAt: row.indexedAt,
        },
      });
  }

  async bulkIndex(docs: SearchDocument[]): Promise<void> {
    const clean = docs.map(doc =>
      this.resolveOwner({ ...doc, content: stripHtml(doc.content) }),
    );

    for (const doc of clean) {
      await this.upsertRow(doc);
    }

    await this.provider().bulkIndex(this.c, clean);
  }

  async clear(itemType?: string): Promise<void> {
    await this.c
      .get("db")
      .delete(core_search_index)
      .where(itemType ? eq(core_search_index.itemType, itemType) : undefined);

    await this.provider().clear(this.c, itemType);
  }

  /**
   * How many documents the **provider** holds, or `null` when it cannot say.
   *
   * `null` is not zero and not healthy: it means the provider offers no
   * diagnostics, and a caller has to report that as unverified rather than
   * turning an absence of evidence into a clean bill of health.
   */
  async countDocuments(args: {
    itemType: string;
    languageCode?: string;
  }): Promise<null | number> {
    const provider = this.provider();
    if (!provider.count) return null;

    return await provider.count(this.c, args);
  }

  /**
   * Removes one item from the index, in one language or in all of them.
   *
   * `languageCode` is the whole point of the overload: multi-language content is
   * one row per `(itemType, itemId, languageCode)`, so taking the Polish
   * translation down must leave the English document exactly where it is.
   * Omitting it removes every language, which is what deleting the record means.
   */
  async delete(
    itemType: string,
    itemId: number,
    languageCode?: string,
  ): Promise<void> {
    await this.c
      .get("db")
      .delete(core_search_index)
      .where(
        and(
          eq(core_search_index.itemType, itemType),
          eq(core_search_index.itemId, itemId),
          languageCode === undefined
            ? undefined
            : eq(core_search_index.languageCode, languageCode),
        ),
      );

    await this.provider().delete(this.c, itemType, itemId, languageCode);
  }

  /** Canonical projection lives in `core_search_index`; the provider mirrors it. */
  async index(doc: SearchDocument): Promise<void> {
    const clean = this.resolveOwner({
      ...doc,
      content: stripHtml(doc.content),
    });

    await this.upsertRow(clean);
    await this.provider().index(this.c, clean);
  }

  /**
   * Whether the active provider's store is the canonical table itself.
   *
   * Diagnostics ask this before counting twice - see
   * {@link SearchProviderCapabilities.canonicalStorage}.
   */
  isCanonicalStorage(): boolean {
    return this.provider().capabilities?.canonicalStorage === true;
  }

  name(): string {
    return this.provider().name;
  }

  async ping(): Promise<boolean> {
    const provider = this.provider();

    return provider.ping ? provider.ping(this.c) : true;
  }

  async search(params: SearchQueryParams): Promise<SearchResult> {
    const result = await this.provider().search(this.c, params);

    return { ...result, edges: await this.hydrateAuthors(result.edges) };
  }
}
