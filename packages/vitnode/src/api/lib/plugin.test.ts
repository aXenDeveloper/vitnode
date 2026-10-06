// @vitest-environment node
import { describe, expect, it } from "vitest";

import { createContentModel } from "@/content/server/model";
import { buildContentPublicModule } from "@/content/server/public-module";
import { definePaymentOffer } from "@/payments/offer";
import {
  testArticleContentType,
  testCategoryContentType,
  testDeliveredPostContentType,
  testSearchablePostContentType,
} from "@/tests/content-fixtures";

import type { SearchIndexer } from "../models/search";

import { validateSearchIndexers } from "../models/search";
import { buildModule } from "./module";
import { buildApiPlugin } from "./plugin";

const contentModule = buildModule({
  pluginId: "@vitnode/example",
  name: "content",
  routes: [],
  contentTypes: [testArticleContentType, testCategoryContentType],
});

const adminModule = buildModule({
  pluginId: "@vitnode/example",
  name: "admin",
  routes: [],
  modules: [contentModule],
});

describe("buildApiPlugin content types", () => {
  it("collects content types from nested modules", () => {
    const plugin = buildApiPlugin({
      pluginId: "@vitnode/example",
      modules: [adminModule],
    });

    expect(plugin.contentTypes?.map(item => item.id)).toEqual([
      "test.article",
      "test.category",
    ]);
  });

  it("derives staff permissions for each collected content type", () => {
    const plugin = buildApiPlugin({
      pluginId: "@vitnode/example",
      modules: [adminModule],
    });

    expect(plugin.permissionStaff?.admin?.article).toEqual([
      "can_view",
      { dependsOn: ["can_view"], permission: "can_create" },
      { dependsOn: ["can_view"], permission: "can_edit" },
      { dependsOn: ["can_view"], permission: "can_delete" },
    ]);
    expect(plugin.permissionStaff?.admin?.category).toBeDefined();
  });

  it("keeps hand-declared permissions and other modules intact", () => {
    const plugin = buildApiPlugin({
      pluginId: "@vitnode/example",
      modules: [adminModule],
      permissionStaff: {
        admin: { article: ["can_view"], posts: ["can_view"] },
        moderator: { posts: ["can_edit"] },
      },
    });

    expect(plugin.permissionStaff?.admin?.article).toEqual(["can_view"]);
    expect(plugin.permissionStaff?.admin?.posts).toEqual(["can_view"]);
    expect(plugin.permissionStaff?.moderator?.posts).toEqual(["can_edit"]);
  });

  it("leaves permissionStaff untouched for a plugin with no content types", () => {
    const plugin = buildApiPlugin({
      pluginId: "@vitnode/example",
      modules: [],
    });

    expect(plugin.contentTypes).toEqual([]);
    expect(plugin.permissionStaff).toBeUndefined();
  });

  it("rejects two content types sharing a table inside one plugin", () => {
    const duplicate = buildModule({
      pluginId: "@vitnode/example",
      name: "content",
      routes: [],
      contentTypes: [testArticleContentType, testArticleContentType],
    });

    expect(() =>
      buildApiPlugin({ pluginId: "@vitnode/example", modules: [duplicate] }),
    ).toThrow(/Duplicate content type id/);
  });
});

const indexer = (itemType: string): SearchIndexer => ({
  itemType,
  load: async () => await Promise.resolve({ documents: [], itemsRead: 0 }),
});

describe("buildApiPlugin search indexers", () => {
  it("collects indexers from nested modules", () => {
    const nested = buildModule({
      pluginId: "@vitnode/example",
      name: "content",
      routes: [],
      searchIndexers: [indexer("test.article")],
    });

    const plugin = buildApiPlugin({
      pluginId: "@vitnode/example",
      modules: [
        buildModule({
          pluginId: "@vitnode/example",
          name: "admin",
          routes: [],
          modules: [nested],
        }),
      ],
    });

    expect(plugin.searchIndexers?.map(item => item.itemType)).toEqual([
      "test.article",
    ]);
  });

  it("merges root-level indexers with collected ones", () => {
    const plugin = buildApiPlugin({
      pluginId: "@vitnode/example",
      modules: [
        buildModule({
          pluginId: "@vitnode/example",
          name: "content",
          routes: [],
          searchIndexers: [indexer("test.article")],
        }),
      ],
      searchIndexers: [indexer("blog_post")],
    });

    expect(plugin.searchIndexers?.map(item => item.itemType)).toEqual([
      "blog_post",
      "test.article",
    ]);
  });

  it("leaves a plugin with no indexers alone", () => {
    const plugin = buildApiPlugin({
      pluginId: "@vitnode/example",
      modules: [adminModule],
    });

    expect(plugin.searchIndexers).toEqual([]);
  });

  it("rejects the same item type registered twice", () => {
    expect(() =>
      buildApiPlugin({
        pluginId: "@vitnode/example",
        modules: [
          buildModule({
            pluginId: "@vitnode/example",
            name: "content",
            routes: [],
            searchIndexers: [indexer("test.article")],
          }),
        ],
        searchIndexers: [indexer("test.article")],
      }),
    ).toThrow(/Duplicate search indexer for item type "test.article"/);
  });
});

describe("validateSearchIndexers", () => {
  it("retains each plugin's ownership after collection", () => {
    // What the AdminCP reports a collection's owner from, and what the rebuild
    // stamps on a legacy document.
    const collected = [
      ...(buildApiPlugin({
        pluginId: "@vitnode/example",
        searchIndexers: [indexer("test.article")],
      }).searchIndexers ?? []),
    ].map(item => ({ ...item, pluginId: "@vitnode/example" }));
    const other = [
      ...(buildApiPlugin({
        pluginId: "@vitnode/blog",
        searchIndexers: [indexer("blog_post")],
      }).searchIndexers ?? []),
    ].map(item => ({ ...item, pluginId: "@vitnode/blog" }));

    expect(
      validateSearchIndexers([...collected, ...other]).map(item => [
        item.itemType,
        item.pluginId,
      ]),
    ).toEqual([
      ["test.article", "@vitnode/example"],
      ["blog_post", "@vitnode/blog"],
    ]);
  });

  it("names both owners of a collision", () => {
    expect(() =>
      validateSearchIndexers([
        { ...indexer("blog_post"), pluginId: "@vitnode/blog" },
        { ...indexer("blog_post"), pluginId: "@vitnode/other" },
      ]),
    ).toThrow(/both "@vitnode\/blog" and "@vitnode\/other"/);
  });

  it("passes distinct item types through", () => {
    expect(
      validateSearchIndexers([
        { ...indexer("blog_post"), pluginId: "@vitnode/blog" },
        { ...indexer("test.article"), pluginId: "@vitnode/example" },
      ]).map(item => item.itemType),
    ).toEqual(["blog_post", "test.article"]);
  });
});

describe("buildApiPlugin public content URLs", () => {
  const PLUGIN_ID = "@vitnode/example";

  const searchableAdmin = buildModule({
    pluginId: PLUGIN_ID,
    name: "admin",
    routes: [],
    contentTypes: [testSearchablePostContentType, testCategoryContentType],
  });

  const deliveredPublic = buildContentPublicModule({
    pluginId: PLUGIN_ID,
    contentTypes: [createContentModel(testDeliveredPostContentType)],
  });

  it("reports every content type that publishes a URL, however it is exposed", () => {
    const plugin = buildApiPlugin({
      pluginId: PLUGIN_ID,
      modules: [searchableAdmin, deliveredPublic],
    });

    expect(plugin.publicContentTypes?.map(item => item.id)).toEqual([
      "test.searchable",
      "test.delivered-post",
    ]);
  });

  it("reports nothing for content without delivery or search", () => {
    expect(
      buildApiPlugin({ pluginId: PLUGIN_ID, modules: [adminModule] })
        .publicContentTypes,
    ).toEqual([]);
  });
});

describe("buildApiPlugin payment offers", () => {
  const offer = definePaymentOffer({
    id: "lifetime",
    mode: "one_time",
    name: "Lifetime",
    onPaid: async () => {},
    prices: { PLN: 1900 },
    returnPath: "/example/payments",
  });

  it("collects offers from every depth of the module tree", () => {
    const nested = buildModule({
      pluginId: "@vitnode/example",
      name: "admin",
      routes: [],
      modules: [
        buildModule({
          pluginId: "@vitnode/example",
          name: "payments",
          routes: [],
          paymentOffers: [offer],
        }),
      ],
    });

    const plugin = buildApiPlugin({
      pluginId: "@vitnode/example",
      modules: [nested],
    });

    expect(plugin.paymentOffers?.map(item => item.id)).toEqual(["lifetime"]);
  });

  it("refuses one offer id declared by two modules of a plugin", () => {
    expect(() =>
      buildApiPlugin({
        pluginId: "@vitnode/example",
        modules: [
          buildModule({
            pluginId: "@vitnode/example",
            name: "a",
            routes: [],
            paymentOffers: [offer],
          }),
          buildModule({
            pluginId: "@vitnode/example",
            name: "b",
            routes: [],
            paymentOffers: [offer],
          }),
        ],
      }),
    ).toThrow(/registered twice/);
  });
});
