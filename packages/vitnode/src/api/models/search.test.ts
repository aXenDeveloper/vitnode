// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";

import type { RegisteredContentType } from "@/content/registry";

import { core_search_index } from "@/database/search";
import {
  testBigintEventContentType,
  testLocalizedPageContentType,
  testLocalizedSearchPageContentType,
  testSearchablePostContentType,
  testStrictLocalizedSearchPageContentType,
  testUuidTagContentType,
} from "@/tests/content-fixtures";

import type { SearchDocument, SearchProviderApiPlugin } from "./search";

import { PostgresSearchAdapter } from "../adapters/search/postgres";
import {
  assertSearchProviderCapabilities,
  normalizeSearchIndexerPage,
  searchItemIdFromKey,
  searchLanguageFallbacks,
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

const registered = (
  definition: RegisteredContentType["definition"],
): RegisteredContentType => ({ definition, pluginId: "@vitnode/core" });

const localizedSearchPage = registered(testLocalizedSearchPageContentType);

describe("searchLanguageFallbacks", () => {
  it("falls back to the default language of a type that asks for it", () => {
    expect(searchLanguageFallbacks([localizedSearchPage], "pl")).toEqual([
      { itemType: "test.localized-search-page", languageCode: "en" },
    ]);
  });

  it("adds nothing when the viewer already reads the default language", () => {
    expect(searchLanguageFallbacks([localizedSearchPage], "EN")).toEqual([]);
  });

  it("skips types that do not fall back, are not localized, or are not searchable", () => {
    expect(
      searchLanguageFallbacks(
        [
          registered(testStrictLocalizedSearchPageContentType),
          registered(testSearchablePostContentType),
          registered(testLocalizedPageContentType),
        ],
        "pl",
      ),
    ).toEqual([]);
  });
});

describe("SearchModel language fallback", () => {
  const contextWith = (provider: SearchProviderApiPlugin) =>
    ({
      get: (key: string) =>
        key === "core"
          ? {
              contentTypes: [localizedSearchPage],
              search: { adapter: provider },
            }
          : undefined,
    }) as unknown as Context;

  it("asks the provider for the default language where a translation is missing", async () => {
    const provider = createProvider();
    const c = contextWith(provider);

    await new SearchModel(c).search({ authorId: 1, languageCode: "pl" });

    expect(provider.search).toHaveBeenCalledWith(c, {
      authorId: 1,
      languageCode: "pl",
      languageFallbacks: [
        { itemType: "test.localized-search-page", languageCode: "en" },
      ],
    });
  });

  it("leaves a search without a language untouched", async () => {
    const provider = createProvider();
    const c = contextWith(provider);

    await new SearchModel(c).search({ authorId: 1 });

    expect(provider.search).toHaveBeenCalledWith(c, { authorId: 1 });
  });
});

describe("item ids under every strategy", () => {
  const BEYOND_SAFE = "9007199254740993";
  const UUID = "0198f6f7-d4a2-7ce1-a2ee-4f5f1f2f3a4b";
  const types = [
    registered(testSearchablePostContentType),
    registered(testBigintEventContentType),
    registered(testUuidTagContentType),
  ];

  it("stores every id as its key, and hands the provider the id itself", async () => {
    const provider = createProvider();
    const { c, values } = createContext(provider);

    await new SearchModel(c).index({
      content: "Body",
      createdAt: new Date("2026-01-01"),
      itemId: BEYOND_SAFE,
      itemType: "test.bigint-event",
      title: "Event",
    });

    expect(values.mock.calls[0][0]).toMatchObject({ itemId: BEYOND_SAFE });
    expect(provider.index).toHaveBeenCalledWith(
      c,
      expect.objectContaining({ itemId: BEYOND_SAFE }),
    );
  });

  it("deletes a uuid record by its key", async () => {
    const provider = createProvider();
    const { c } = createContext(provider);

    await new SearchModel(c).delete("test.uuid-tag", UUID, "en");

    expect(provider.delete).toHaveBeenCalledWith(
      c,
      "test.uuid-tag",
      UUID,
      "en",
    );
  });

  it("reads a key back as the id its content type uses", () => {
    expect(searchItemIdFromKey(types, "test.searchable", "42")).toBe(42);
    expect(searchItemIdFromKey(types, "test.bigint-event", BEYOND_SAFE)).toBe(
      BEYOND_SAFE,
    );
    expect(searchItemIdFromKey(types, "test.uuid-tag", UUID)).toBe(UUID);
  });

  it("keeps a numeric key a number for an item type that is not a content type", () => {
    expect(searchItemIdFromKey(types, "forum.topic", "7")).toBe(7);
    expect(searchItemIdFromKey(undefined, "forum.topic", "7")).toBe(7);
    expect(searchItemIdFromKey(types, "forum.topic", "abc")).toBe("abc");
  });
});
