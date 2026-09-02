// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

import type { SearchIndexer } from "../models/search";

import { validateSearchIndexers } from "../models/search";
import { defineWorkflow } from "../workflows/define";
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

describe("buildApiPlugin workflows", () => {
  const workflow = (id: string, version: number) =>
    defineWorkflow({
      id,
      input: z.object({ orderId: z.number() }),
      steps: ({ step }) => [step({ id: "reserve", run: () => undefined })],
      version,
    });

  it("collects workflows from nested modules, keeping the owning module", () => {
    const plugin = buildApiPlugin({
      pluginId: "@vitnode/example",
      modules: [
        buildModule({
          pluginId: "@vitnode/example",
          name: "admin",
          routes: [],
          modules: [
            buildModule({
              pluginId: "@vitnode/example",
              name: "orders",
              routes: [],
              workflows: [workflow("place-order", 1)],
            }),
          ],
        }),
      ],
    });

    expect(
      plugin.workflows?.map(entry => [entry.definition.id, entry.module]),
    ).toEqual([["place-order", "orders"]]);
  });

  it("registers two versions of one workflow side by side", () => {
    const plugin = buildApiPlugin({
      pluginId: "@vitnode/example",
      modules: [
        buildModule({
          pluginId: "@vitnode/example",
          name: "orders",
          routes: [],
          workflows: [workflow("place-order", 1), workflow("place-order", 2)],
        }),
      ],
    });

    expect(plugin.workflows?.map(entry => entry.definition.version)).toEqual([
      1, 2,
    ]);
  });

  it("refuses the same workflow id and version twice inside one plugin", () => {
    expect(() =>
      buildApiPlugin({
        pluginId: "@vitnode/example",
        modules: [
          buildModule({
            pluginId: "@vitnode/example",
            name: "orders",
            routes: [],
            workflows: [workflow("place-order", 1)],
          }),
          buildModule({
            pluginId: "@vitnode/example",
            name: "checkout",
            routes: [],
            workflows: [workflow("place-order", 1)],
          }),
        ],
      }),
    ).toThrow(/already registered by module "orders" and again by "checkout"/);
  });
});
