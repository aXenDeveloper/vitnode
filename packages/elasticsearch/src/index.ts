import type { estypes } from "@elastic/elasticsearch";
import type {
  SearchDocument,
  SearchHit,
  SearchProviderApiPlugin,
  SearchQueryParams,
  SearchResult,
} from "@vitnode/core/api/models/search";

import { Client, errors } from "@elastic/elasticsearch";

const DEFAULT_INDEX = "vitnode";
const DEFAULT_SIZE = 20;
const MAX_SIZE = 100;

interface RankingOptions {
  authorBoost?: { authorIds: number[]; weight: number };
  timeDecay?: { decay?: number; offset?: string; scale?: string };
}

export interface ElasticsearchAdapterOptions {
  apiKey?: string;
  cloudId?: string;
  index?: string;
  node?: string;
  password?: string;
  ranking?: RankingOptions;
  username?: string;
}

interface EsSource {
  authorId: null | number;
  containerId: null | number;
  containerType: null | string;
  content: string;
  createdAt: string;
  isPublic: boolean;
  itemId: number;
  itemType: string;
  languageCode: string;
  metadata: Record<string, unknown>;
  pluginId: string;
  title: string;
  url: null | string;
}

const docId = (
  itemType: string,
  itemId: number,
  languageCode: string,
): string => `${itemType}:${itemId}:${languageCode}`;

interface EsErrorBody {
  error?: { type?: string };
}

const isIndexAlreadyExistsError = (error: unknown): boolean =>
  error instanceof errors.ResponseError &&
  (error.body as EsErrorBody | undefined)?.error?.type ===
    "resource_already_exists_exception";

const toSource = (doc: SearchDocument): EsSource => ({
  // `SearchModel` resolves ownership before any provider sees the document, so
  // this fallback is only for a provider called directly - it must never be the
  // reason a mirrored document disagrees with the canonical row.
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
  createdAt: (doc.createdAt instanceof Date
    ? doc.createdAt
    : new Date(doc.createdAt)
  ).toISOString(),
});

const buildFilters = (
  params: SearchQueryParams,
): estypes.QueryDslQueryContainer[] => {
  const filter: estypes.QueryDslQueryContainer[] = [];

  if (params.languageCode) {
    // Language-agnostic rows (empty `languageCode`) match every locale.
    filter.push({ terms: { languageCode: [params.languageCode, ""] } });
  }
  if (params.itemTypes?.length) {
    filter.push({ terms: { itemType: params.itemTypes } });
  }
  if (params.authorId !== undefined) {
    filter.push({ term: { authorId: params.authorId } });
  }
  if (params.containerId !== undefined) {
    filter.push({ term: { containerId: params.containerId } });
  }
  if (params.dateFrom || params.dateTo) {
    filter.push({
      range: {
        createdAt: {
          gte: params.dateFrom?.toISOString(),
          lte: params.dateTo?.toISOString(),
        },
      },
    });
  }
  if (!params.includePrivate) {
    filter.push({ term: { isPublic: true } });
  }

  return filter;
};

const buildRankingFunctions = (
  ranking: RankingOptions,
): estypes.QueryDslFunctionScoreContainer[] => {
  const functions: estypes.QueryDslFunctionScoreContainer[] = [];

  if (ranking.timeDecay) {
    functions.push({
      gauss: {
        createdAt: {
          scale: ranking.timeDecay.scale ?? "30d",
          offset: ranking.timeDecay.offset ?? "1d",
          decay: ranking.timeDecay.decay ?? 0.5,
        },
      },
    });
  }
  if (ranking.authorBoost && ranking.authorBoost.authorIds.length > 0) {
    functions.push({
      filter: { terms: { authorId: ranking.authorBoost.authorIds } },
      weight: ranking.authorBoost.weight,
    });
  }

  return functions;
};

const buildQuery = (
  params: SearchQueryParams,
  ranking: RankingOptions | undefined,
): estypes.QueryDslQueryContainer => {
  const term = params.term?.trim();
  const must: estypes.QueryDslQueryContainer[] = term
    ? [
        {
          multi_match: {
            query: term,
            fields: ["title^3", "content"],
            type: "best_fields",
          },
        },
      ]
    : [{ match_all: {} }];

  const base: estypes.QueryDslQueryContainer = {
    bool: { must, filter: buildFilters(params) },
  };

  const scoresByRelevance =
    params.sort !== "newest" && params.sort !== "oldest";
  const functions = ranking ? buildRankingFunctions(ranking) : [];

  if (term && scoresByRelevance && functions.length > 0) {
    return {
      function_score: {
        query: base,
        functions,
        score_mode: "sum",
        boost_mode: "multiply",
      },
    };
  }

  return base;
};

const buildSort = (params: SearchQueryParams): estypes.Sort => {
  if (params.sort === "newest") return [{ createdAt: { order: "desc" } }];
  if (params.sort === "oldest") return [{ createdAt: { order: "asc" } }];

  return ["_score", { createdAt: { order: "desc" } }];
};

const mapHit = (hit: estypes.SearchHit<EsSource>): null | SearchHit => {
  const source = hit._source;
  if (!source) return null;

  return {
    id: source.itemId,
    pluginId: source.pluginId,
    itemType: source.itemType,
    itemId: source.itemId,
    languageCode: source.languageCode,
    authorId: source.authorId,
    title: source.title,
    content: source.content,
    containerType: source.containerType,
    containerId: source.containerId,
    url: source.url,
    metadata: source.metadata,
    createdAt: new Date(source.createdAt),
    score: hit._score ?? null,
    author: null,
  };
};

export const ElasticsearchSearchAdapter = (
  options: ElasticsearchAdapterOptions,
): SearchProviderApiPlugin => {
  const index = options.index ?? DEFAULT_INDEX;
  let client: Client | undefined;
  let ensured = false;
  let ensuring: Promise<void> | undefined;

  const getClient = (): Client => {
    if (!(options.node || options.cloudId)) {
      throw new Error(
        "Missing Elasticsearch configuration: provide `node` or `cloudId`.",
      );
    }

    client ??= new Client({
      node: options.node,
      cloud: options.cloudId ? { id: options.cloudId } : undefined,
      auth: options.apiKey
        ? { apiKey: options.apiKey }
        : options.username
          ? { username: options.username, password: options.password ?? "" }
          : undefined,
    });

    return client;
  };

  const createIndexIfMissing = async (): Promise<void> => {
    const es = getClient();
    if (await es.indices.exists({ index })) return;

    try {
      await es.indices.create({
        index,
        mappings: {
          properties: {
            pluginId: { type: "keyword" },
            itemType: { type: "keyword" },
            itemId: { type: "integer" },
            languageCode: { type: "keyword" },
            authorId: { type: "integer" },
            title: { type: "text" },
            content: { type: "text" },
            containerType: { type: "keyword" },
            containerId: { type: "integer" },
            url: { type: "keyword" },
            isPublic: { type: "boolean" },
            createdAt: { type: "date" },
            metadata: { type: "object", enabled: false },
          },
        },
      });
    } catch (error) {
      if (!isIndexAlreadyExistsError(error)) throw error;
    }
  };

  const ensureIndex = async (): Promise<void> => {
    if (ensured) return;
    ensuring ??= createIndexIfMissing();

    try {
      await ensuring;
      ensured = true;
    } catch (error) {
      ensuring = undefined;
      throw error;
    }
  };

  return {
    name: "elasticsearch",
    capabilities: { facets: true, timeDecay: true, authorBoost: true },

    index: async (_c, doc) => {
      await ensureIndex();
      await getClient().index({
        index,
        id: docId(doc.itemType, doc.itemId, doc.languageCode ?? ""),
        document: toSource(doc),
      });
    },

    bulkIndex: async (_c, docs) => {
      if (docs.length === 0) return;
      await ensureIndex();

      const operations = docs.flatMap(doc => [
        {
          index: {
            _index: index,
            _id: docId(doc.itemType, doc.itemId, doc.languageCode ?? ""),
          },
        },
        toSource(doc),
      ]);

      await getClient().bulk({ operations, refresh: false });
    },

    // One document per language shares an (itemType, itemId), so remove every
    // language variant with a query rather than a single id - unless the caller
    // named one, which is how a single translation is taken down without
    // touching the others.
    delete: async (_c, itemType, itemId, languageCode) => {
      await getClient().deleteByQuery(
        {
          index,
          query: {
            bool: {
              filter: [
                { term: { itemType } },
                { term: { itemId } },
                ...(languageCode === undefined
                  ? []
                  : [{ term: { languageCode } }]),
              ],
            },
          },
        },
        { ignore: [404] },
      );
    },

    clear: async (_c, itemType) => {
      await getClient().deleteByQuery(
        {
          index,
          query: itemType ? { term: { itemType } } : { match_all: {} },
        },
        { ignore: [404] },
      );
    },

    ping: async () => {
      try {
        return await getClient().ping();
      } catch {
        return false;
      }
    },

    search: async (_c, params): Promise<SearchResult> => {
      await ensureIndex();

      const size = Math.min(params.first ?? DEFAULT_SIZE, MAX_SIZE);
      const from = params.cursor ? Number(params.cursor) : 0;

      const res = await getClient().search<EsSource>({
        index,
        from,
        size,
        track_total_hits: true,
        query: buildQuery(params, options.ranking),
        sort: buildSort(params),
      });

      const total =
        typeof res.hits.total === "number"
          ? res.hits.total
          : (res.hits.total?.value ?? 0);
      const edges = res.hits.hits
        .map(mapHit)
        .filter((hit): hit is SearchHit => hit !== null);

      return {
        edges,
        pageInfo: {
          totalCount: total,
          count: edges.length,
          hasNextPage: from + edges.length < total,
          hasPreviousPage: from > 0,
          startCursor: from,
          endCursor: from + edges.length,
        },
      };
    },
  };
};
