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

const createContext = (provider: SearchProviderApiPlugin) => {
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
      if (key === "plugin") return undefined;

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
