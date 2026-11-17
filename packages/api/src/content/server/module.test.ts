import { describe, expect, it } from "vitest";

import {
  testAdvancedLocalizedContentType,
  testCategoryContentType,
  testDuplicableNoteContentType,
  testEditorialPostContentType,
  testHideablePostContentType,
  testPostContentType,
  testSearchablePostContentType,
} from "@/tests/content-fixtures";
import { testManifest } from "@/tests/manifest";

import type { ContentMcpOperation } from "./mcp";

import { collectPluginMcpTools } from "../../lib/mcp/registry";
import { buildApiPlugin } from "../../lib/plugin";
import { CONTENT_MCP_OPERATIONS } from "./mcp";
import { createContentModel } from "./model";
import { buildContentAdminModule } from "./module";
import { buildContentRoutes } from "./routes";

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
      manifest: testManifest(PLUGIN_ID),
      modules: [adminModule([searchablePosts])],
    });

    expect(plugin.searchIndexers?.map(item => item.itemType)).toEqual([
      "test.searchable",
    ]);
  });

  it("keeps a manual indexer alongside a generated one", () => {
    const plugin = buildApiPlugin({
      manifest: testManifest(PLUGIN_ID),
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
        manifest: testManifest(PLUGIN_ID),
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
      manifest: testManifest(PLUGIN_ID),
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

describe("buildContentAdminModule mcp", () => {
  const localized = createContentModel(testAdvancedLocalizedContentType);

  const toolsOf = (
    contentTypes: Parameters<typeof buildContentAdminModule>[0]["contentTypes"],
    mcp: Record<string, readonly ContentMcpOperation[]>,
  ) =>
    collectPluginMcpTools({
      modules: [
        buildContentAdminModule({ contentTypes, mcp, pluginId: PLUGIN_ID }),
      ],
      pluginId: PLUGIN_ID,
    });

  it("exposes only the listed operations, named after the content type and operation", () => {
    const tools = toolsOf([categories, localized], {
      "test.advanced-localized": ["list", "createLocalized"],
    });

    expect(tools.map(({ method, name }) => [method, name])).toEqual([
      ["POST", "vitnode-example__test_advanced_localized_create_localized"],
      ["GET", "vitnode-example__test_advanced_localized_list"],
    ]);
  });

  it("refuses a content type that is not in the module", () => {
    expect(() => toolsOf([categories], { "test.missing": ["list"] })).toThrow(
      /names "test.missing", which is not one of this module's content types/,
    );
  });

  it.each<[string, ContentMcpOperation, RegExp]>([
    [
      "an operation the type has no route for",
      "publish",
      /has no POST \/\{id\}\/publish route/,
    ],
    [
      "a name that is no operation",
      "upload" as ContentMcpOperation,
      /"upload" is not an MCP operation/,
    ],
  ])("refuses %s", (_label, operation, message) => {
    expect(() =>
      toolsOf([categories], { "test.category": [operation] }),
    ).toThrow(message);
  });

  it.each([
    testAdvancedLocalizedContentType,
    testDuplicableNoteContentType,
    testEditorialPostContentType,
    testHideablePostContentType,
  ])("turns every operation $id has into a valid tool", definition => {
    const model = createContentModel(definition);
    const routes = buildContentRoutes(model, { pluginId: PLUGIN_ID });
    const operations = (
      Object.entries(CONTENT_MCP_OPERATIONS) as [
        ContentMcpOperation,
        { method: string; path: string },
      ][]
    )
      .filter(([, spec]) =>
        routes.some(
          ({ route }) =>
            route.method === spec.method && route.path === spec.path,
        ),
      )
      .map(([operation]) => operation);

    expect(toolsOf([model], { [definition.id]: operations })).toHaveLength(
      operations.length,
    );
  });
});
