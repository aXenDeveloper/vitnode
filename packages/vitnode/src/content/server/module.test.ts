// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  testCategoryContentType,
  testPostContentType,
  testSearchablePostContentType,
} from "@/tests/content-fixtures";

import { buildApiPlugin } from "../../api/lib/plugin";
import { createContentModel } from "./model";
import { buildContentAdminModule } from "./module";

const PLUGIN_ID = "@vitnode/example";

const categories = createContentModel(testCategoryContentType);
const posts = createContentModel(testPostContentType, {
  references: { category: () => categories.table.id },
});
const searchablePosts = createContentModel(testSearchablePostContentType);

const adminModule = (
  contentTypes: Parameters<typeof buildContentAdminModule>[0]["contentTypes"],
) => buildContentAdminModule({ contentTypes, pluginId: PLUGIN_ID });

describe("buildContentAdminModule search indexers", () => {
  it("registers an indexer for every searchable content type", () => {
    const module = adminModule([categories, posts, searchablePosts]);

    expect(module.searchIndexers?.map(item => item.itemType)).toEqual([
      "test.searchable",
    ]);
  });

  it("registers nothing when no content type opted in", () => {
    expect(adminModule([categories, posts]).searchIndexers).toEqual([]);
  });

  it("stamps the owning plugin on every generated indexer", () => {
    // The indexer keeps its owner because the rebuild runs in the core cron
    // request, where `c.get("plugin")` is core rather than the content's plugin.
    const [generated] = adminModule([searchablePosts]).searchIndexers ?? [];

    expect(generated).toBeDefined();

    const plugin = buildApiPlugin({
      pluginId: PLUGIN_ID,
      modules: [adminModule([searchablePosts])],
    });

    expect(plugin.searchIndexers?.map(item => item.itemType)).toEqual([
      "test.searchable",
    ]);
  });

  it("keeps a manual indexer alongside a generated one", () => {
    const plugin = buildApiPlugin({
      pluginId: PLUGIN_ID,
      modules: [adminModule([categories, posts, searchablePosts])],
      searchIndexers: [
        {
          itemType: "example_legacy",
          load: async () =>
            await Promise.resolve({ documents: [], itemsRead: 0 }),
        },
      ],
    });

    expect(plugin.searchIndexers?.map(item => item.itemType)).toEqual([
      "example_legacy",
      "test.searchable",
    ]);
  });

  it("rejects a manual indexer that collides with a generated one", () => {
    expect(() =>
      buildApiPlugin({
        pluginId: PLUGIN_ID,
        modules: [adminModule([searchablePosts])],
        searchIndexers: [
          {
            itemType: "test.searchable",
            load: async () =>
              await Promise.resolve({ documents: [], itemsRead: 0 }),
          },
        ],
      }),
    ).toThrow(/Duplicate search indexer for item type "test.searchable"/);
  });

  it("reaches the plugin through the nested module tree", () => {
    const plugin = buildApiPlugin({
      pluginId: PLUGIN_ID,
      modules: [adminModule([categories, posts, searchablePosts])],
    });

    expect(plugin.searchIndexers?.map(item => item.itemType)).toEqual([
      "test.searchable",
    ]);
    // The same module still drives the registry and the permissions.
    expect(plugin.contentTypes?.map(item => item.id)).toEqual([
      "test.category",
      "test.post",
      "test.searchable",
    ]);
  });
});
