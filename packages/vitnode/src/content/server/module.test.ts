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
