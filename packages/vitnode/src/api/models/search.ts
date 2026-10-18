import type { Context } from "hono";

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { SearchPopularitySignal } from "@/api/lib/search-popularity";
import type { SearchSuggestion } from "@/api/lib/search-suggestions";
import type { ContentId } from "@/content/ids";
import type { RegisteredContentType } from "@/content/registry";

import {
  deleteSearchPopularity,
  recordSearchPopularity,
} from "@/api/lib/search-popularity";
import {
  canonicalPopularSearchItems,
  canonicalSearchSuggestions,
} from "@/api/lib/search-suggestions";
import { storageUrlOf } from "@/api/lib/storage-url";
import { contentIdFromKey, contentIdKey } from "@/content/ids";
import { contentLocalesMatch } from "@/content/locale";
import { core_files } from "@/database/files";
import { core_search_index, core_search_popularity } from "@/database/search";
import { core_users } from "@/database/users";
import { containsLikePattern } from "@/lib/api/like-pattern";
import { parseImageDimensions } from "@/lib/api/upload";
import { stripHtml } from "@/lib/strip-html";

const authorAvatarFile = alias(core_files, "search_author_avatar_file");

const SEARCH_TOP_AUTHORS_TTL_SECONDS = 5 * 60;

// Rows per multi-row upsert: 17 columns × 500 stays far below Postgres' 65,535
// bind-parameter cap while still turning a rebuild page into one round trip.
const BULK_UPSERT_CHUNK = 500;

export interface SearchDocument {
  authorIds?: readonly number[];
  containerId?: number;
  containerType?: string;
  content: string;
  createdAt: Date;
  imageId?: null | number;
  isHidden?: boolean;
  isPublic?: boolean;
  itemId: ContentId;
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
  authorIds?: readonly number[];
  containerId?: number;
  cursor?: string;
  dateFrom?: Date;
  dateTo?: Date;
  first?: number;
  hiddenAccess?: SearchHiddenAccess;
  includePrivate?: boolean;
  itemTypes?: string[];
  // Restrict results to one locale (the viewer's). Rows with an empty
  // `languageCode` (language-agnostic content) always match.
  languageCode?: string;
  languageFallbacks?: SearchLanguageFallback[];
  sort?: "newest" | "oldest" | "relevance";
  term?: string;
}

export interface SearchHiddenAccess {
  authorId?: number;
  itemTypes: readonly string[];
}

export interface SearchLanguageFallback {
  itemType: string;
  languageCode: string;
}

export const searchLanguageFallbacks = (
  contentTypes: readonly RegisteredContentType[],
  languageCode: string,
): SearchLanguageFallback[] =>
  contentTypes.flatMap(({ definition: { id, localization, search } }) =>
    search.enabled &&
    localization.enabled &&
    localization.fallback === "default" &&
    !contentLocalesMatch(localization.defaultLocale, languageCode)
      ? [{ itemType: id, languageCode: localization.defaultLocale }]
      : [],
  );

const NUMERIC_KEY = /^[1-9][0-9]{0,14}$/;

export const searchItemIdFromKey = (
  contentTypes: readonly RegisteredContentType[],
  itemType: string,
  key: string,
): ContentId => {
  const contentType = contentTypes.find(
    entry => entry.definition.id === itemType,
  );
  if (contentType) {
    return contentIdFromKey(contentType.definition.idStrategy, key) ?? key;
  }

  return NUMERIC_KEY.test(key) ? Number(key) : key;
};

export interface SearchHitAuthor {
  avatarColor: string;
  avatarUrl: null | string;
  id: number;
  name: string;
  nameCode: string;
}

export interface SearchHitImage {
  height?: number;
  url: string;
  width?: number;
}

export type SearchSuggestionResult = Omit<SearchSuggestion, "imageId"> & {
  image: null | SearchHitImage;
};

export interface SearchHit {
  author: null | SearchHitAuthor;
  authorId: null | number;
  authorIds: number[];
  authors: SearchHitAuthor[];
  containerId: null | number;
  containerType: null | string;
  content: string;
  createdAt: Date;
  id: number;
  image: null | SearchHitImage;
  imageId: null | number;
  isHidden: boolean;
  isPublic: boolean;
  itemId: ContentId;
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

  canonicalStorage?: boolean;
  facets: boolean;

  languageScopedDelete?: boolean;
  timeDecay: boolean;
}

export interface SearchIndexerPage {
  documents: SearchDocument[];
  /** Source rows this page read. `0` means the source is exhausted. */
  itemsRead: number;
}

export type LegacySearchIndexerPage = SearchDocument[];

export type SearchIndexerLoadResult =
  // The one intentional use of the deprecated shape: this union is what keeps
  // pre-Stage-3 indexers compiling, so the lint rule has nothing to warn about
  // here. Every *other* reference should be flagged.

  LegacySearchIndexerPage | SearchIndexerPage;

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

export const searchDocumentOwner = (
  pluginId: null | string | undefined,
): string | undefined => {
  const trimmed = pluginId?.trim();

  return trimmed === "" ? undefined : trimmed;
};

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
  countByType?: (
    c: Context,
    params: SearchQueryParams,
  ) => Promise<Record<string, number>>;
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
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  delete(
    c: Context,
    itemType: string,
    itemId: ContentId,
    languageCode?: string,
  ): Promise<void>;
  /**
   * Removes many items of one type, in every language - what deleting a
   * container means for its children. Optional: without it, {@link SearchModel}
   * falls back to one `delete` per item.
   */
  deleteMany?: (
    c: Context,
    itemType: string,
    itemIds: ContentId[],
  ) => Promise<void>;
  index: (c: Context, doc: SearchDocument) => Promise<void>;
  name: string;
  ping?: (c: Context) => Promise<boolean>;
  search: (c: Context, params: SearchQueryParams) => Promise<SearchResult>;
}

const toRow = (doc: SearchDocument) => ({
  pluginId: doc.pluginId ?? "core",
  itemType: doc.itemType,
  itemId: contentIdKey(doc.itemId),
  languageCode: doc.languageCode ?? "",
  authorIds: [...new Set(doc.authorIds ?? [])],
  title: doc.title,
  content: doc.content,
  containerType: doc.containerType ?? null,
  containerId: doc.containerId ?? null,
  url: doc.url ?? null,
  isPublic: doc.isPublic ?? true,
  isHidden: doc.isHidden ?? false,
  imageId: doc.imageId ?? null,
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

  private async hydrateAuthors(edges: SearchHit[]): Promise<SearchHit[]> {
    const idsOf = (edge: SearchHit): number[] =>
      edge.authorIds.length > 0
        ? edge.authorIds
        : edge.authorId
          ? [edge.authorId]
          : [];
    const wanted = [...new Set(edges.flatMap(idsOf))];
    if (wanted.length === 0) {
      return edges.map(edge => ({ ...edge, authorIds: [], authors: [] }));
    }

    const rows = await this.c
      .get("db")
      .select({
        id: core_users.id,
        name: core_users.name,
        nameCode: core_users.nameCode,
        avatarColor: core_users.avatarColor,
        avatarKey: authorAvatarFile.key,
      })
      .from(core_users)
      .leftJoin(authorAvatarFile, eq(authorAvatarFile.id, core_users.avatarId))
      .where(inArray(core_users.id, wanted));

    const byId = new Map(
      rows.map(({ avatarKey, ...row }) => [
        row.id,
        { ...row, avatarUrl: storageUrlOf(this.c, avatarKey) },
      ]),
    );

    return edges.map(edge => {
      const authorIds = idsOf(edge);
      const authors = authorIds.flatMap(id => {
        const author = byId.get(id);

        return author ? [author] : [];
      });

      return {
        ...edge,
        author: edge.author ?? authors[0] ?? null,
        authorIds,
        authors,
      };
    });
  }

  private async hydrateImages<T extends { imageId: null | number }>(
    edges: T[],
  ): Promise<(T & { image: null | SearchHitImage })[]> {
    const wanted = [
      ...new Set(
        edges.flatMap(edge => (edge.imageId === null ? [] : [edge.imageId])),
      ),
    ];
    if (wanted.length === 0) {
      return edges.map(edge => ({ ...edge, image: null }));
    }

    const rows = await this.c
      .get("db")
      .select({
        id: core_files.id,
        key: core_files.key,
        metadata: core_files.metadata,
        mimeType: core_files.mimeType,
      })
      .from(core_files)
      .where(inArray(core_files.id, wanted));

    const byId = new Map(
      rows.flatMap(row => {
        const url = row.mimeType?.startsWith("image/")
          ? storageUrlOf(this.c, row.key)
          : null;
        if (!url) return [];
        const dimensions = parseImageDimensions(row.metadata);

        return [
          [
            row.id,
            {
              url,
              ...(dimensions
                ? { height: dimensions.height, width: dimensions.width }
                : {}),
            },
          ] as const,
        ];
      }),
    );

    return edges.map(edge => ({
      ...edge,
      image: edge.imageId === null ? null : (byId.get(edge.imageId) ?? null),
    }));
  }

  private async newCommentParent(
    doc: SearchDocument,
  ): Promise<null | { itemId: string; itemType: string }> {
    if (doc.isPublic === false) return null;
    if (doc.containerType === undefined || doc.containerId === undefined) {
      return null;
    }

    const parentType = doc.containerType;
    const isIndexedContent = (this.c.get("core")?.contentTypes ?? []).some(
      ({ definition }) =>
        definition.id === parentType && definition.search.enabled,
    );
    if (!isIndexedContent) return null;
    if (await this.isListed(doc.itemType, contentIdKey(doc.itemId))) {
      return null;
    }

    return { itemId: contentIdKey(doc.containerId), itemType: parentType };
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

  /**
   * One multi-row upsert per chunk. A statement may not touch the same row
   * twice, so a batch that names one `(itemType, itemId, languageCode)` more
   * than once keeps the last copy - what writing them one by one would leave.
   */
  private async upsertRows(docs: SearchDocument[]): Promise<void> {
    const byKey = new Map<string, ReturnType<typeof toRow>>();
    for (const doc of docs) {
      const row = toRow(doc);
      const key = JSON.stringify([row.itemType, row.itemId, row.languageCode]);
      byKey.delete(key);
      byKey.set(key, row);
    }
    const rows = [...byKey.values()];

    for (let start = 0; start < rows.length; start += BULK_UPSERT_CHUNK) {
      await this.c
        .get("db")
        .insert(core_search_index)
        .values(rows.slice(start, start + BULK_UPSERT_CHUNK))
        .onConflictDoUpdate({
          target: [
            core_search_index.itemType,
            core_search_index.itemId,
            core_search_index.languageCode,
          ],
          set: {
            // Included so a rebuild corrects the owner of a row written before
            // the indexer declared one, rather than leaving the first writer's
            // guess.
            pluginId: sql`excluded."pluginId"`,
            authorIds: sql`excluded."authorIds"`,
            title: sql`excluded."title"`,
            content: sql`excluded."content"`,
            containerType: sql`excluded."containerType"`,
            containerId: sql`excluded."containerId"`,
            url: sql`excluded."url"`,
            isPublic: sql`excluded."isPublic"`,
            isHidden: sql`excluded."isHidden"`,
            imageId: sql`excluded."imageId"`,
            metadata: sql`excluded."metadata"`,
            createdAt: sql`excluded."createdAt"`,
            updatedAt: sql`excluded."updatedAt"`,
            indexedAt: sql`excluded."indexedAt"`,
          },
        });
    }
  }

  private withFallbacks(params: SearchQueryParams): SearchQueryParams {
    const languageFallbacks = params.languageCode
      ? searchLanguageFallbacks(
          this.c.get("core").contentTypes,
          params.languageCode,
        )
      : [];

    return languageFallbacks.length > 0
      ? { ...params, languageFallbacks }
      : params;
  }

  private async withSuggestionImages(
    suggestions: SearchSuggestion[],
  ): Promise<SearchSuggestionResult[]> {
    const hydrated = await this.hydrateImages(suggestions);

    return hydrated.map(({ imageId: _imageId, ...suggestion }) => suggestion);
  }

  async authors({
    limit,
    term,
  }: {
    limit: number;
    term?: string;
  }): Promise<SearchHitAuthor[]> {
    const db = this.c.get("db");
    const listed = and(
      eq(core_search_index.isPublic, true),
      eq(core_search_index.isHidden, false),
    );
    const columns = {
      id: core_users.id,
      name: core_users.name,
      nameCode: core_users.nameCode,
      avatarColor: core_users.avatarColor,
      avatarKey: authorAvatarFile.key,
    };
    const toAuthor = ({
      avatarKey,
      ...row
    }: Omit<SearchHitAuthor, "avatarUrl"> & {
      avatarKey: null | string;
    }): SearchHitAuthor => ({
      ...row,
      avatarUrl: storageUrlOf(this.c, avatarKey),
    });

    if (term) {
      const rows = await db
        .select(columns)
        .from(core_users)
        .leftJoin(
          authorAvatarFile,
          eq(authorAvatarFile.id, core_users.avatarId),
        )
        .where(
          and(
            ilike(core_users.name, containsLikePattern(term)),
            exists(
              db
                .select({ id: core_search_index.id })
                .from(core_search_index)
                .where(
                  and(
                    listed,
                    sql`${core_search_index.authorIds} @> ARRAY[${core_users.id}]::integer[]`,
                  ),
                ),
            ),
          ),
        )
        .orderBy(asc(core_users.name))
        .limit(limit);

      return rows.map(toAuthor);
    }

    const topAuthorIds = await this.c
      .get("cache")
      .remember(
        `search:top-authors:${limit}`,
        SEARCH_TOP_AUTHORS_TTL_SECONDS,
        async () => {
          const activity = db
            .select({
              authorId: sql<number>`unnest(${core_search_index.authorIds})`.as(
                "author_id",
              ),
            })
            .from(core_search_index)
            .where(listed)
            .as("activity");
          const top = await db
            .select({ authorId: activity.authorId, total: count() })
            .from(activity)
            .groupBy(activity.authorId)
            .orderBy(desc(count()), asc(activity.authorId))
            .limit(limit);

          return top.map(row => row.authorId);
        },
      );
    if (topAuthorIds.length === 0) return [];

    const rows = await db
      .select(columns)
      .from(core_users)
      .leftJoin(authorAvatarFile, eq(authorAvatarFile.id, core_users.avatarId))
      .where(inArray(core_users.id, topAuthorIds));
    const byId = new Map(rows.map(row => [row.id, toAuthor(row)]));

    return topAuthorIds.flatMap(authorId => {
      const author = byId.get(authorId);

      return author ? [author] : [];
    });
  }

  async bulkIndex(docs: SearchDocument[]): Promise<void> {
    const clean = docs.map(doc =>
      this.resolveOwner({ ...doc, content: stripHtml(doc.content) }),
    );

    await this.upsertRows(clean);
    await this.provider().bulkIndex(this.c, clean);
  }

  async clear(itemType?: string): Promise<void> {
    await this.c
      .get("db")
      .delete(core_search_index)
      .where(itemType ? eq(core_search_index.itemType, itemType) : undefined);

    await this.provider().clear(this.c, itemType);
  }

  async countByType(
    params: SearchQueryParams,
  ): Promise<null | Record<string, number>> {
    const provider = this.provider();
    if (!provider.countByType) return null;

    return await provider.countByType(this.c, this.withFallbacks(params));
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
    itemId: ContentId,
    languageCode?: string,
  ): Promise<void> {
    await this.c
      .get("db")
      .delete(core_search_index)
      .where(
        and(
          eq(core_search_index.itemType, itemType),
          eq(core_search_index.itemId, contentIdKey(itemId)),
          languageCode === undefined
            ? undefined
            : eq(core_search_index.languageCode, languageCode),
        ),
      );

    if (languageCode === undefined) {
      await deleteSearchPopularity(this.c, {
        itemId: contentIdKey(itemId),
        itemType,
      });
    }

    await this.provider().delete(this.c, itemType, itemId, languageCode);
  }

  async deleteByContainer({
    containerId,
    containerType,
    itemType,
  }: {
    containerId: number;
    containerType: string;
    itemType: string;
  }): Promise<void> {
    const db = this.c.get("db");
    const rows = await db
      .selectDistinct({ itemId: core_search_index.itemId })
      .from(core_search_index)
      .where(
        and(
          eq(core_search_index.itemType, itemType),
          eq(core_search_index.containerType, containerType),
          eq(core_search_index.containerId, containerId),
        ),
      );
    const itemKeys = rows.map(row => row.itemId);
    if (itemKeys.length === 0) return;

    // The provider first, the canonical rows last: if the provider call fails,
    // the rows are still there for a retry to find what it has to delete.
    const contentTypes = this.c.get("core")?.contentTypes ?? [];
    const itemIds = itemKeys.map(key =>
      searchItemIdFromKey(contentTypes, itemType, key),
    );
    const provider = this.provider();
    if (provider.deleteMany) {
      await provider.deleteMany(this.c, itemType, itemIds);
    } else {
      for (const itemId of itemIds) {
        await provider.delete(this.c, itemType, itemId);
      }
    }

    // Every language of every item, not only the rows filed under the container.
    await db
      .delete(core_search_index)
      .where(
        and(
          eq(core_search_index.itemType, itemType),
          inArray(core_search_index.itemId, itemKeys),
        ),
      );
    await db
      .delete(core_search_popularity)
      .where(
        and(
          eq(core_search_popularity.itemType, itemType),
          inArray(core_search_popularity.itemId, itemKeys),
        ),
      );
  }

  /** Canonical projection lives in `core_search_index`; the provider mirrors it. */
  async index(doc: SearchDocument): Promise<void> {
    const clean = this.resolveOwner({
      ...doc,
      content: stripHtml(doc.content),
    });

    const commentParent = await this.newCommentParent(clean);

    await this.upsertRows([clean]);
    await this.provider().index(this.c, clean);

    if (commentParent) {
      await recordSearchPopularity(this.c, {
        ...commentParent,
        signal: "comment",
      });
    }
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

  async isListed(itemType: string, itemId: string): Promise<boolean> {
    const [row] = await this.c
      .get("db")
      .select({ id: core_search_index.id })
      .from(core_search_index)
      .where(
        and(
          eq(core_search_index.itemType, itemType),
          eq(core_search_index.itemId, itemId),
          eq(core_search_index.isPublic, true),
        ),
      )
      .limit(1);

    return row !== undefined;
  }

  name(): string {
    return this.provider().name;
  }

  async ping(): Promise<boolean> {
    const provider = this.provider();

    return provider.ping ? provider.ping(this.c) : true;
  }

  async popular({
    languageCode,
    limit,
  }: {
    languageCode?: string;
    limit: number;
  }): Promise<SearchSuggestionResult[]> {
    return await this.withSuggestionImages(
      await canonicalPopularSearchItems(this.c, {
        limit,
        params: this.withFallbacks({ includePrivate: false, languageCode }),
      }),
    );
  }

  async recordPopularity({
    itemId,
    itemType,
    signal,
  }: {
    itemId: string;
    itemType: string;
    signal: SearchPopularitySignal;
  }): Promise<void> {
    await recordSearchPopularity(this.c, { itemId, itemType, signal });
  }

  async search(params: SearchQueryParams): Promise<SearchResult> {
    const result = await this.provider().search(
      this.c,
      this.withFallbacks(params),
    );

    const [withAuthors, withImages] = await Promise.all([
      this.hydrateAuthors(result.edges),
      this.hydrateImages(result.edges),
    ]);

    return {
      ...result,
      edges: withAuthors.map((edge, index) => ({
        ...edge,
        image: withImages[index]?.image ?? null,
      })),
    };
  }

  async suggest({
    limit,
    term,
    ...params
  }: Omit<SearchQueryParams, "term"> & {
    limit: number;
    term: string;
  }): Promise<SearchSuggestionResult[]> {
    return await this.withSuggestionImages(
      await canonicalSearchSuggestions(this.c, {
        limit,
        params: this.withFallbacks(params),
        term,
      }),
    );
  }
}
