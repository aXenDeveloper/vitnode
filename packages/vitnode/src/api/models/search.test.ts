// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";

import { core_search_index } from "@/database/search";

import type { SearchDocument, SearchProviderApiPlugin } from "./search";

import { PostgresSearchAdapter } from "../adapters/search/postgres";
import {
  assertSearchProviderCapabilities,
  normalizeSearchIndexerPage,
  SearchModel,
} from "./search";

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

    it("treats a blank owner as absent", async () => {
      // `pluginId` is public input, so an empty or whitespace-only string is a
      // missing owner - not a collection called "".
      const provider = createProvider();
      const { c, values } = createContext(provider, "@vitnode/example");

      await new SearchModel(c).index({ ...doc, pluginId: "   " });

      expect(values.mock.calls[0][0].pluginId).toBe("@vitnode/example");
    });

    it("falls back to core for a blank owner outside a plugin request", async () => {
      const provider = createProvider();
      const { c, values } = createContext(provider);

      await new SearchModel(c).index({ ...doc, pluginId: "" });

      expect(values.mock.calls[0][0].pluginId).toBe("core");
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
    // No language: deleting the record means every language of it.
    expect(provider.delete).toHaveBeenCalledWith(c, "blog_post", 5, undefined);
  });

  it("deletes one language without touching the others", async () => {
    const provider = createProvider();
    const { c, deleteFn } = createContext(provider);

    // Multi-language content is one row per `(itemType, itemId, languageCode)`,
    // so taking the Polish translation down must leave the English one indexed.
    await new SearchModel(c).delete("blog_post", 5, "pl");

    expect(deleteFn).toHaveBeenCalledWith(core_search_index);
    expect(provider.delete).toHaveBeenCalledWith(c, "blog_post", 5, "pl");
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

describe("normalizeSearchIndexerPage", () => {
  const document: SearchDocument = {
    content: "body",
    createdAt: new Date("2026-01-01"),
    itemId: 1,
    itemType: "legacy.item",
    title: "Hello",
  };

  it("passes a modern page through untouched", () => {
    const page = { documents: [document], itemsRead: 7 };

    expect(normalizeSearchIndexerPage(page, 200)).toBe(page);
  });

  it("keeps a modern page that read rows but produced nothing", () => {
    // The whole reason the object form exists: this must not read as exhausted.
    expect(
      normalizeSearchIndexerPage({ documents: [], itemsRead: 200 }, 200),
    ).toEqual({ documents: [], itemsRead: 200 });
  });

  it("reports the requested limit for a non-empty legacy array", () => {
    // Not `documents.length`: a legacy indexer may emit several documents per
    // source row, so the array length would skip rows on every page.
    expect(normalizeSearchIndexerPage([document], 200)).toEqual({
      documents: [document],
      itemsRead: 200,
    });
  });

  it("reports the requested limit however many documents a page holds", () => {
    expect(
      normalizeSearchIndexerPage([document, document, document, document], 200)
        .itemsRead,
    ).toBe(200);
  });

  it("treats an empty legacy array as an exhausted source", () => {
    expect(normalizeSearchIndexerPage([], 200)).toEqual({
      documents: [],
      itemsRead: 0,
    });
  });
});

/**
 * The one provider capability that is not a nicety.
 *
 * `delete(c, itemType, itemId, languageCode)` is a JavaScript call: a provider
 * written before per-locale content accepts the fourth argument and drops it, so
 * taking one translation down removes every language from that provider's store
 * while the canonical `core_search_index` removes one. Nothing throws, nothing is
 * logged, and the two disagree from then on - which is why the pairing is refused
 * at boot instead of being discovered by whoever deletes a translation.
 */
describe("assertSearchProviderCapabilities", () => {
  const legacy = (): SearchProviderApiPlugin => ({
    ...createProvider(),
    name: "legacy-engine",
  });

  const scoped = (): SearchProviderApiPlugin => ({
    ...createProvider(),
    name: "scoped-engine",
    capabilities: {
      authorBoost: false,
      facets: false,
      languageScopedDelete: true,
      timeDecay: false,
    },
  });

  it("allows a provider that declares nothing when nothing is localized", () => {
    expect(() =>
      assertSearchProviderCapabilities(legacy(), {
        localizedSearchContentTypes: [],
      }),
    ).not.toThrow();
  });

  it("refuses a provider that cannot scope a delete to one language", () => {
    expect(() =>
      assertSearchProviderCapabilities(legacy(), {
        localizedSearchContentTypes: ["example.article"],
      }),
    ).toThrow(/legacy-engine/);
  });

  it("names the content type and the missing capability", () => {
    // A boot failure is only useful if it says what to change.
    expect(() =>
      assertSearchProviderCapabilities(legacy(), {
        localizedSearchContentTypes: ["example.article"],
      }),
    ).toThrow(/example\.article/);
    expect(() =>
      assertSearchProviderCapabilities(legacy(), {
        localizedSearchContentTypes: ["example.article"],
      }),
    ).toThrow(/languageScopedDelete/);
  });

  it("refuses a provider that declares the other capabilities but not this one", () => {
    // Declaring `capabilities` is not the same as declaring this capability.
    const partial: SearchProviderApiPlugin = {
      ...createProvider(),
      name: "facets-only",
      capabilities: { authorBoost: true, facets: true, timeDecay: true },
    };

    expect(() =>
      assertSearchProviderCapabilities(partial, {
        localizedSearchContentTypes: ["example.article"],
      }),
    ).toThrow(/facets-only/);
  });

  it("allows a provider that declares it", () => {
    expect(() =>
      assertSearchProviderCapabilities(scoped(), {
        localizedSearchContentTypes: ["example.article", "example.page"],
      }),
    ).not.toThrow();
  });

  it("lists every offending content type, not just the first", () => {
    expect(() =>
      assertSearchProviderCapabilities(legacy(), {
        localizedSearchContentTypes: ["example.article", "example.page"],
      }),
    ).toThrow(/example\.article", "example\.page/);
  });

  it("says yes to the bundled Postgres provider", async () => {
    // Its store *is* `core_search_index`, which `SearchModel.delete` already
    // narrows by language before the provider is reached.
    const { PostgresSearchAdapter } =
      await import("@/api/adapters/search/postgres");

    expect(() =>
      assertSearchProviderCapabilities(PostgresSearchAdapter(), {
        localizedSearchContentTypes: ["example.article"],
      }),
    ).not.toThrow();
  });
});

/**
 * The provider half of a search diagnostic.
 *
 * `SearchModel.index` writes the canonical row and *then* hands the document to
 * the provider, so the two can disagree - and a diagnostic that cannot ask the
 * provider would report the canonical table's health as the whole story.
 */
describe("provider diagnostics", () => {
  const modelFor = (provider: SearchProviderApiPlugin) =>
    new SearchModel({
      get: (key: string) =>
        key === "core" ? { search: { adapter: provider } } : undefined,
    } as never);

  it("reports the bundled Postgres provider as canonical storage", () => {
    // Its store *is* `core_search_index`, so a diagnostic can use the canonical
    // count rather than paying for a second one over the same rows.
    expect(modelFor(PostgresSearchAdapter()).isCanonicalStorage()).toBe(true);
  });

  it("reports a mirroring provider as not canonical", () => {
    expect(modelFor(createProvider()).isCanonicalStorage()).toBe(false);
  });

  it("answers null when the provider offers no count", async () => {
    // `null` is not zero and not healthy - it means nobody looked, and the
    // caller has to report that as unverified.
    await expect(
      modelFor(createProvider()).countDocuments({ itemType: "blog_post" }),
    ).resolves.toBeNull();
  });

  it("passes the item type and language straight through", async () => {
    const count = vi.fn().mockResolvedValue(12);
    const model = modelFor({ ...createProvider(), count });

    await expect(
      model.countDocuments({ itemType: "blog_post", languageCode: "pl" }),
    ).resolves.toBe(12);
    expect(count.mock.calls[0][1]).toEqual({
      itemType: "blog_post",
      languageCode: "pl",
    });
  });
});
