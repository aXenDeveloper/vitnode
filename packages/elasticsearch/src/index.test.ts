import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  Client,
  ResponseError,
  bulk,
  index,
  deleteByQuery,
  countDocs,
  ping,
  search,
  exists,
  create,
} = vi.hoisted(() => {
  const index = vi.fn();
  const bulk = vi.fn();
  const del = vi.fn();
  const deleteByQuery = vi.fn();
  const countDocs = vi.fn();
  const ping = vi.fn();
  const search = vi.fn();
  const exists = vi.fn();
  const create = vi.fn();
  const Client = vi.fn(function () {
    return {
      index,
      bulk,
      delete: del,
      deleteByQuery,
      count: countDocs,
      ping,
      search,
      indices: { exists, create },
    };
  });
  class ResponseError extends Error {
    constructor(body: unknown) {
      super("elasticsearch response error");
      this.body = body;
    }
    body: unknown;
  }

  return {
    Client,
    ResponseError,
    bulk,
    index,
    deleteByQuery,
    countDocs,
    ping,
    search,
    exists,
    create,
  };
});

vi.mock("@elastic/elasticsearch", () => ({
  Client,
  errors: { ResponseError },
}));

const alreadyExistsError = () =>
  new ResponseError({ error: { type: "resource_already_exists_exception" } });

import { ElasticsearchSearchAdapter } from "./index";

const c = {} as never;
const config = { node: "http://localhost:9200", index: "test" };
const doc = {
  itemType: "blog_post",
  itemId: 1,
  title: "Hi",
  content: "Hello world",
  authorId: 5,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  exists.mockReset().mockResolvedValue(true);
  create.mockReset().mockResolvedValue(undefined);
});

describe("ElasticsearchSearchAdapter configuration", () => {
  it("throws when neither node nor cloudId is provided", async () => {
    await expect(
      ElasticsearchSearchAdapter({}).delete(c, "blog_post", 1),
    ).rejects.toThrow("Missing Elasticsearch configuration");
    expect(Client).not.toHaveBeenCalled();
  });

  it("constructs the client lazily and reuses it", async () => {
    const adapter = ElasticsearchSearchAdapter(config);
    expect(Client).not.toHaveBeenCalled();

    await adapter.delete(c, "blog_post", 1);
    await adapter.delete(c, "blog_post", 2);

    expect(Client).toHaveBeenCalledTimes(1);
  });
});

describe("ElasticsearchSearchAdapter.index", () => {
  it("indexes a document with a deterministic id and ISO date", async () => {
    await ElasticsearchSearchAdapter(config).index(c, doc);

    expect(index).toHaveBeenCalledWith({
      index: "test",
      id: "blog_post:1:",
      document: expect.objectContaining({
        itemType: "blog_post",
        itemId: 1,
        authorId: 5,
        title: "Hi",
        content: "Hello world",
        isPublic: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    });
  });

  it("creates the index with a mapping when it does not exist", async () => {
    exists.mockResolvedValue(false);

    await ElasticsearchSearchAdapter(config).index(c, doc);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ index: "test" }),
    );
  });

  it("defaults languageCode to an empty string when omitted", async () => {
    await ElasticsearchSearchAdapter(config).index(c, doc);

    expect(index).toHaveBeenCalledWith(
      expect.objectContaining({
        document: expect.objectContaining({ languageCode: "" }),
      }),
    );
  });

  it("indexes the document languageCode and scopes the id by language", async () => {
    await ElasticsearchSearchAdapter(config).index(c, {
      ...doc,
      languageCode: "pl",
    });

    expect(index).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "blog_post:1:pl",
        document: expect.objectContaining({ languageCode: "pl" }),
      }),
    );
  });

  it("keeps language variants of one item as distinct documents", async () => {
    const adapter = ElasticsearchSearchAdapter(config);

    await adapter.index(c, { ...doc, languageCode: "en" });
    await adapter.index(c, { ...doc, languageCode: "pl" });

    const ids = index.mock.calls.map(call => call[0].id);
    expect(ids).toEqual(["blog_post:1:en", "blog_post:1:pl"]);
  });
});

describe("ElasticsearchSearchAdapter plugin ownership", () => {
  it("serializes the document's owning plugin", async () => {
    await ElasticsearchSearchAdapter(config).index(c, {
      ...doc,
      pluginId: "@vitnode/example",
    });

    expect(index).toHaveBeenCalledWith(
      expect.objectContaining({
        document: expect.objectContaining({ pluginId: "@vitnode/example" }),
      }),
    );
  });

  it("serializes each owner in a bulk write", async () => {
    await ElasticsearchSearchAdapter(config).bulkIndex(c, [
      { ...doc, itemId: 1, pluginId: "@vitnode/example" },
      { ...doc, itemId: 2, pluginId: "@vitnode/blog" },
    ]);

    const { operations } = bulk.mock.calls[0][0] as {
      operations: { pluginId?: string }[];
    };

    // Alternating action/document pairs, so the sources are the odd entries.
    expect(operations[1].pluginId).toBe("@vitnode/example");
    expect(operations[3].pluginId).toBe("@vitnode/blog");
  });

  it("falls back to core for a document with no owner", async () => {
    // `SearchModel` resolves ownership before any provider sees a document, so
    // this only covers a provider called directly.
    await ElasticsearchSearchAdapter(config).index(c, doc);

    expect(index).toHaveBeenCalledWith(
      expect.objectContaining({
        document: expect.objectContaining({ pluginId: "core" }),
      }),
    );
  });
});

describe("ElasticsearchSearchAdapter index initialization", () => {
  it("creates the index only once under concurrent calls", async () => {
    exists.mockResolvedValue(false);
    const adapter = ElasticsearchSearchAdapter(config);

    await Promise.all([
      adapter.index(c, doc),
      adapter.index(c, doc),
      adapter.bulkIndex(c, [doc]),
    ]);

    expect(exists).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does not re-check the index after it is ensured", async () => {
    exists.mockResolvedValue(true);
    const adapter = ElasticsearchSearchAdapter(config);

    await adapter.index(c, doc);
    await adapter.index(c, doc);

    expect(exists).toHaveBeenCalledTimes(1);
  });

  it("swallows resource_already_exists_exception from a concurrent creator", async () => {
    exists.mockResolvedValue(false);
    create.mockRejectedValue(alreadyExistsError());

    await expect(
      ElasticsearchSearchAdapter(config).index(c, doc),
    ).resolves.toBeUndefined();

    expect(index).toHaveBeenCalledTimes(1);
  });

  it("propagates unexpected errors from create", async () => {
    exists.mockResolvedValue(false);
    create.mockRejectedValue(new Error("cluster unavailable"));

    await expect(
      ElasticsearchSearchAdapter(config).index(c, doc),
    ).rejects.toThrow("cluster unavailable");
  });

  it("retries initialization after a transient failure", async () => {
    exists.mockRejectedValueOnce(new Error("network")).mockResolvedValue(true);
    const adapter = ElasticsearchSearchAdapter(config);

    await expect(adapter.index(c, doc)).rejects.toThrow("network");
    await expect(adapter.index(c, doc)).resolves.toBeUndefined();

    expect(exists).toHaveBeenCalledTimes(2);
    expect(index).toHaveBeenCalledTimes(1);
  });
});

describe("ElasticsearchSearchAdapter.delete", () => {
  it("removes every language variant of an item by query", async () => {
    await ElasticsearchSearchAdapter(config).delete(c, "blog_post", 1);

    expect(deleteByQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          bool: {
            filter: [
              { term: { itemType: "blog_post" } },
              { term: { itemId: 1 } },
            ],
          },
        },
      }),
      { ignore: [404] },
    );
  });

  /**
   * The behaviour `capabilities.languageScopedDelete` promises, asserted rather
   * than trusted: an install pairing a localized searchable content type with a
   * provider that dropped this argument would take every language out of the
   * index on a single translation's unpublish, with no error to notice.
   */
  it("narrows the query to one language when given a locale", async () => {
    await ElasticsearchSearchAdapter(config).delete(c, "blog_post", 1, "pl");

    expect(deleteByQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          bool: {
            filter: [
              { term: { itemType: "blog_post" } },
              { term: { itemId: 1 } },
              { term: { languageCode: "pl" } },
            ],
          },
        },
      }),
      { ignore: [404] },
    );
  });

  it("declares the capability its delete actually honours", () => {
    expect(
      ElasticsearchSearchAdapter(config).capabilities?.languageScopedDelete,
    ).toBe(true);
  });
});

describe("ElasticsearchSearchAdapter.clear", () => {
  it("clears one type with a term query", async () => {
    await ElasticsearchSearchAdapter(config).clear(c, "blog_post");

    expect(deleteByQuery).toHaveBeenCalledWith(
      expect.objectContaining({ query: { term: { itemType: "blog_post" } } }),
      { ignore: [404] },
    );
  });

  it("clears everything with match_all", async () => {
    await ElasticsearchSearchAdapter(config).clear(c);

    expect(deleteByQuery).toHaveBeenCalledWith(
      expect.objectContaining({ query: { match_all: {} } }),
      { ignore: [404] },
    );
  });
});

describe("ElasticsearchSearchAdapter.search", () => {
  beforeEach(() => {
    search.mockResolvedValue({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _id: "blog_post:1",
            _score: 1.23,
            _source: {
              pluginId: "core",
              itemType: "blog_post",
              itemId: 1,
              languageCode: "en",
              authorId: 5,
              title: "Hi",
              content: "Hello world",
              containerType: null,
              containerId: null,
              url: "/blog/1/hi",
              isPublic: true,
              metadata: {},
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          },
        ],
      },
    });
  });

  it("maps hits and pagination, leaving author for the model to hydrate", async () => {
    const result = await ElasticsearchSearchAdapter(config).search(c, {
      term: "hello",
      sort: "relevance",
      first: 20,
    });

    expect(result.pageInfo.totalCount).toBe(1);
    expect(result.edges[0]).toMatchObject({
      itemId: 1,
      languageCode: "en",
      authorId: 5,
      score: 1.23,
      author: null,
      url: "/blog/1/hi",
    });
  });

  it("filters by languageCode, matching the locale and language-agnostic rows", async () => {
    await ElasticsearchSearchAdapter(config).search(c, {
      term: "hello",
      sort: "relevance",
      languageCode: "en",
    });

    const arg = search.mock.calls[0][0];
    expect(arg.query.bool.filter).toContainEqual({
      terms: { languageCode: ["en", ""] },
    });
  });

  it("omits the languageCode filter when no locale is requested", async () => {
    await ElasticsearchSearchAdapter(config).search(c, {
      term: "hello",
      sort: "relevance",
    });

    const arg = search.mock.calls[0][0];
    expect(arg.query.bool.filter).not.toContainEqual(
      expect.objectContaining({
        terms: expect.objectContaining({ languageCode: expect.anything() }),
      }),
    );
  });

  it("builds a multi_match query for a term", async () => {
    await ElasticsearchSearchAdapter(config).search(c, {
      term: "hello",
      sort: "relevance",
    });

    const arg = search.mock.calls[0][0];
    expect(arg.query.bool.must[0].multi_match.query).toBe("hello");
  });

  it("wraps the query in function_score when ranking is configured", async () => {
    await ElasticsearchSearchAdapter({
      ...config,
      ranking: { timeDecay: { scale: "30d" } },
    }).search(c, { term: "hello", sort: "relevance" });

    const arg = search.mock.calls[0][0];
    expect(arg.query.function_score).toBeDefined();
    expect(arg.query.function_score.functions[0].gauss).toBeDefined();
  });

  it("sorts by date without a term", async () => {
    await ElasticsearchSearchAdapter(config).search(c, { sort: "newest" });

    const arg = search.mock.calls[0][0];
    expect(arg.sort).toEqual([{ createdAt: { order: "desc" } }]);
  });
});

describe("ElasticsearchSearchAdapter.ping", () => {
  it("returns the client ping result", async () => {
    ping.mockResolvedValue(true);

    expect(await ElasticsearchSearchAdapter(config).ping?.(c)).toBe(true);
  });

  it("returns false when ping throws", async () => {
    ping.mockRejectedValue(new Error("down"));

    expect(await ElasticsearchSearchAdapter(config).ping?.(c)).toBe(false);
  });
});

/**
 * Provider-level diagnostics.
 *
 * The canonical `core_search_index` and this index are two storages, and only
 * one of them is what a visitor actually searches. A drift diagnostic that could
 * not ask this one would report a perfectly healthy canonical table while the
 * search box was missing results - which is the failure this API exists to make
 * visible.
 */
describe("ElasticsearchSearchAdapter.count", () => {
  it("declares itself countable, so diagnostics can verify it", () => {
    const adapter = ElasticsearchSearchAdapter(config);

    expect(typeof adapter.count).toBe("function");
    // And it is *not* the canonical storage: it mirrors, so it can drift.
    expect(adapter.capabilities?.canonicalStorage).toBeUndefined();
  });

  it("counts one collection without fetching a single document", async () => {
    countDocs.mockResolvedValue({ count: 42 });

    const total = await ElasticsearchSearchAdapter(config).count?.(c, {
      itemType: "blog_post",
    });

    expect(total).toBe(42);
    // `_count`, never `_search`: a diagnostic over a large index has to cost
    // the same as one over an empty one.
    expect(search).not.toHaveBeenCalled();
    expect(countDocs.mock.calls[0][0]).toMatchObject({
      index: "test",
      query: { bool: { filter: [{ term: { itemType: "blog_post" } }] } },
    });
  });

  it("narrows to one language when asked", async () => {
    // Per-locale is the whole point: "Polish is missing forty documents" is not
    // something a single total can say.
    countDocs.mockResolvedValue({ count: 7 });

    await ElasticsearchSearchAdapter(config).count?.(c, {
      itemType: "blog_post",
      languageCode: "pl",
    });

    expect(countDocs.mock.calls[0][0].query.bool.filter).toEqual([
      { term: { itemType: "blog_post" } },
      { term: { languageCode: "pl" } },
    ]);
  });

  it("reads an index that does not exist yet as empty", async () => {
    // An install that has never rebuilt has no index. That is drift to report,
    // not a crash in the status route.
    countDocs.mockResolvedValue({});

    await expect(
      ElasticsearchSearchAdapter(config).count?.(c, { itemType: "blog_post" }),
    ).resolves.toBe(0);
    expect(countDocs.mock.calls[0][1]).toMatchObject({ ignore: [404] });
  });

  it("lets a transport failure surface, so the caller can report it", async () => {
    // Swallowing it here would turn "Elasticsearch is down" into "zero
    // documents", which reads as drift rather than as an outage.
    countDocs.mockRejectedValue(new Error("connect ECONNREFUSED"));

    await expect(
      ElasticsearchSearchAdapter(config).count?.(c, { itemType: "blog_post" }),
    ).rejects.toThrow("connect ECONNREFUSED");
  });
});
