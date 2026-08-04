// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";

import { core_search_index } from "@/database/search";

import type { SearchProviderApiPlugin } from "./search";

import { SearchModel } from "./search";

const createProvider = (): SearchProviderApiPlugin => ({
  name: "postgres",
  index: vi.fn().mockResolvedValue(undefined),
  bulkIndex: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  search: vi.fn().mockResolvedValue({
    edges: [],
    pageInfo: {
      totalCount: 0,
      count: 0,
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
      endCursor: null,
    },
  }),
});

const createContext = (
  provider: SearchProviderApiPlugin,
  requestPluginId?: string,
) => {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn<
    (row: { content: string; isPublic: boolean; pluginId: string }) => {
      onConflictDoUpdate: typeof onConflictDoUpdate;
    }
  >(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  const where = vi.fn().mockResolvedValue(undefined);
  const deleteFn = vi.fn(() => ({ where }));
  const db = { insert, delete: deleteFn };

  const c = {
    get: (key: string) => {
      if (key === "db") return db;
      if (key === "core") return { search: { adapter: provider } };
      if (key === "plugin") {
        return requestPluginId ? { id: requestPluginId } : undefined;
      }

      return undefined;
    },
  } as unknown as Context;

  return { c, insert, values, deleteFn, where };
};

describe("SearchModel", () => {
  it("upserts the canonical row, strips HTML, and mirrors to the provider", async () => {
    const provider = createProvider();
    const { c, insert, values } = createContext(provider);
    const doc = {
      itemType: "blog_post",
      itemId: 1,
      title: "Hello",
      content: "<p>Hello <b>world</b></p>",
      createdAt: new Date("2026-01-01"),
    };

    await new SearchModel(c).index(doc);

    expect(insert).toHaveBeenCalledWith(core_search_index);
    const row = values.mock.calls[0][0];
    expect(row.content).toBe("Hello world");
    expect(row.pluginId).toBe("core");
    expect(row.isPublic).toBe(true);
    expect(provider.index).toHaveBeenCalledWith(c, {
      ...doc,
      content: "Hello world",
      pluginId: "core",
    });
  });

  describe("plugin ownership", () => {
    const doc = {
      content: "body",
      createdAt: new Date("2026-01-01"),
      itemId: 1,
      itemType: "example.article",
      title: "Hello",
    };

    it("prefers an explicit document owner over the request", async () => {
      // A rebuild runs inside the core cron request, so the request's plugin is
      // not the owner - the document has to win, or the same record would be
      // stored differently depending on which path wrote it.
      const provider = createProvider();
      const { c, values } = createContext(provider, "@vitnode/core");

      await new SearchModel(c).index({ ...doc, pluginId: "@vitnode/example" });

      expect(values.mock.calls[0][0].pluginId).toBe("@vitnode/example");
      expect(provider.index).toHaveBeenCalledWith(
        c,
        expect.objectContaining({ pluginId: "@vitnode/example" }),
      );
    });

    it("falls back to the request's plugin", async () => {
      const provider = createProvider();
      const { c, values } = createContext(provider, "@vitnode/example");

      await new SearchModel(c).index(doc);

      expect(values.mock.calls[0][0].pluginId).toBe("@vitnode/example");
      expect(provider.index).toHaveBeenCalledWith(
        c,
        expect.objectContaining({ pluginId: "@vitnode/example" }),
      );
    });

    it("falls back to core outside a plugin request", async () => {
      const provider = createProvider();
      const { c, values } = createContext(provider);

      await new SearchModel(c).index(doc);

      expect(values.mock.calls[0][0].pluginId).toBe("core");
    });

    it("resolves every document in a bulk write", async () => {
      const provider = createProvider();
      const { c, values } = createContext(provider, "@vitnode/core");

      await new SearchModel(c).bulkIndex([
        { ...doc, itemId: 1, pluginId: "@vitnode/example" },
        { ...doc, itemId: 2, pluginId: "@vitnode/blog" },
        // No owner declared: the request's plugin stands in.
        { ...doc, itemId: 3 },
      ]);

      expect(values.mock.calls.map(call => call[0].pluginId)).toEqual([
        "@vitnode/example",
        "@vitnode/blog",
        "@vitnode/core",
      ]);
      expect(provider.bulkIndex).toHaveBeenCalledWith(c, [
        expect.objectContaining({ itemId: 1, pluginId: "@vitnode/example" }),
        expect.objectContaining({ itemId: 2, pluginId: "@vitnode/blog" }),
        expect.objectContaining({ itemId: 3, pluginId: "@vitnode/core" }),
      ]);
    });

    it("rewrites the owner of an existing row on conflict", async () => {
      // Otherwise a row written before its indexer declared an owner would keep
      // the first writer's guess forever, and a rebuild could not repair it.
      const provider = createProvider();
      const { c, values } = createContext(provider, "@vitnode/example");

      await new SearchModel(c).index(doc);

      const { onConflictDoUpdate } = values.mock.results[0].value;
      expect(onConflictDoUpdate.mock.calls[0][0].set).toMatchObject({
        pluginId: "@vitnode/example",
      });
    });
  });

  it("deletes the canonical row and mirrors the delete", async () => {
    const provider = createProvider();
    const { c, deleteFn } = createContext(provider);

    await new SearchModel(c).delete("blog_post", 5);

    expect(deleteFn).toHaveBeenCalledWith(core_search_index);
    expect(provider.delete).toHaveBeenCalledWith(c, "blog_post", 5);
  });

  it("delegates search to the provider", async () => {
    const provider = createProvider();
    const { c } = createContext(provider);

    await new SearchModel(c).search({ term: "hello", sort: "relevance" });

    expect(provider.search).toHaveBeenCalledWith(c, {
      term: "hello",
      sort: "relevance",
    });
  });
});
