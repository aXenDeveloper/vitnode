// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

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

    expect(plugin.permissionStaff?.admin?.test_articles).toEqual([
      "can_view",
      { dependsOn: ["can_view"], permission: "can_create" },
      { dependsOn: ["can_view"], permission: "can_edit" },
      { dependsOn: ["can_view"], permission: "can_delete" },
    ]);
    expect(plugin.permissionStaff?.admin?.test_categories).toBeDefined();
  });

  it("keeps hand-declared permissions and other modules intact", () => {
    const plugin = buildApiPlugin({
      pluginId: "@vitnode/example",
      modules: [adminModule],
      permissionStaff: {
        admin: { posts: ["can_view"], test_articles: ["can_view"] },
        moderator: { posts: ["can_edit"] },
      },
    });

    expect(plugin.permissionStaff?.admin?.test_articles).toEqual(["can_view"]);
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
