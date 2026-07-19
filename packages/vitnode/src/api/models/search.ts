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
  facets: boolean;
  timeDecay: boolean;
}

/**
 * Streams every existing item of one content type so the whole index can be
 * rebuilt (e.g. after switching engines). `load` returns one page at a time;
 * return fewer than `limit` rows to signal the end.
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
  ) => Promise<SearchDocument[]>;
}

export interface SearchIndexerConfig extends SearchIndexer {
  pluginId: string;
}

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
  delete: (c: Context, itemType: string, itemId: number) => Promise<void>;
  index: (c: Context, doc: SearchDocument) => Promise<void>;
  name: string;
  ping?: (c: Context) => Promise<boolean>;
  search: (c: Context, params: SearchQueryParams) => Promise<SearchResult>;
}

const toRow = (doc: SearchDocument) => ({
  pluginId: "core",
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

  private async upsertRow(doc: SearchDocument): Promise<void> {
    const row = { ...toRow(doc), pluginId: this.c.get("plugin")?.id ?? "core" };

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
    const clean = docs.map(doc => ({
      ...doc,
      content: stripHtml(doc.content),
    }));

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

  async delete(itemType: string, itemId: number): Promise<void> {
    await this.c
      .get("db")
      .delete(core_search_index)
      .where(
        and(
          eq(core_search_index.itemType, itemType),
          eq(core_search_index.itemId, itemId),
        ),
      );

    await this.provider().delete(this.c, itemType, itemId);
  }

  /** Canonical projection lives in `core_search_index`; the provider mirrors it. */
  async index(doc: SearchDocument): Promise<void> {
    const clean = { ...doc, content: stripHtml(doc.content) };

    await this.upsertRow(clean);
    await this.provider().index(this.c, clean);
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
