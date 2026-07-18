import { beforeEach, describe, expect, it, vi } from "vitest";

const { Client, index, bulk, del, deleteByQuery, ping, search, exists, create } =
  vi.hoisted(() => {
    const index = vi.fn();
    const bulk = vi.fn();
    const del = vi.fn();
    const deleteByQuery = vi.fn();
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
        ping,
        search,
        indices: { exists, create },
      };
    });

    return {
      Client,
      index,
      bulk,
      del,
      deleteByQuery,
      ping,
      search,
      exists,
      create,
    };
  });

vi.mock("@elastic/elasticsearch", () => ({ Client }));

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
  exists.mockResolvedValue(true);
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
      id: "blog_post:1",
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
      authorId: 5,
      score: 1.23,
      author: null,
      url: "/blog/1/hi",
    });
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
