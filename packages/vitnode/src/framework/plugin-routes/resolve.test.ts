import { describe, expect, it } from "vitest";

import type { PluginRoute } from "../../routing/types.js";
import type { PluginRouteEntrySource } from "./types.js";

import { pluginRouteId } from "../../routing/manifest.js";
import {
  pluginIdsFromLoadedConfig,
  pluginRouteEntrySources,
  resolvePluginRouteModules,
  routeDeclarationsFromManifest,
  sortAndAssertUnique,
  toSingleQuotedLiteral,
} from "./resolve.js";

const source = (
  pluginId: string,
  ...routes: { entry: string; id: string }[]
): PluginRouteEntrySource => ({ pluginId, routes });

describe("resolvePluginRouteModules", () => {
  it("pairs each declaration with the specifier it will be imported by", () => {
    expect(
      resolvePluginRouteModules([
        source("@vitnode/example", {
          entry: "routes/example-page",
          id: "example-page",
        }),
      ]),
    ).toEqual([
      {
        entry: "routes/example-page",
        key: "@vitnode/example:example-page",
        pluginId: "@vitnode/example",
        routeId: "example-page",
        specifier: "@vitnode/example/routes/example-page",
      },
    ]);
  });

  it("orders by key, not by the order the plugins were configured in", () => {
    const forwards = resolvePluginRouteModules([
      source("@vitnode/example", { entry: "routes/b", id: "b" }),
      source("@vitnode/blog", { entry: "routes/a", id: "a" }),
    ]);
    const backwards = resolvePluginRouteModules([
      source("@vitnode/blog", { entry: "routes/a", id: "a" }),
      source("@vitnode/example", { entry: "routes/b", id: "b" }),
    ]);

    expect(forwards.map(module => module.key)).toEqual([
      "@vitnode/blog:a",
      "@vitnode/example:b",
    ]);
    expect(backwards).toEqual(forwards);
  });

  it("orders one plugin's own routes by key too", () => {
    expect(
      resolvePluginRouteModules([
        source(
          "@vitnode/example",
          { entry: "routes/zebra", id: "zebra" },
          { entry: "routes/alpha", id: "alpha" },
          { entry: "routes/nested/leaf", id: "nested/leaf" },
        ),
      ]).map(module => module.routeId),
    ).toEqual(["alpha", "nested/leaf", "zebra"]);
  });

  it("returns nothing for a plugin that declares no routes", () => {
    expect(resolvePluginRouteModules([source("@vitnode/blog")])).toEqual([]);
    expect(resolvePluginRouteModules([{ pluginId: "@vitnode/blog" }])).toEqual(
      [],
    );
  });

  it("rejects two declarations claiming one key", () => {
    expect(() =>
      resolvePluginRouteModules([
        source(
          "@vitnode/example",
          { entry: "routes/one", id: "duplicate" },
          { entry: "routes/two", id: "duplicate" },
        ),
      ]),
    ).toThrow(/same registry key: "@vitnode\/example:duplicate"/);
  });

  it("rejects the same key contributed by two configured entries", () => {
    expect(() =>
      resolvePluginRouteModules([
        source("@vitnode/example", { entry: "routes/one", id: "page" }),
        source("@vitnode/example", { entry: "routes/one", id: "page" }),
      ]),
    ).toThrow(/same registry key/);
  });

  it("allows two route ids pointing at one module", () => {
    expect(
      resolvePluginRouteModules([
        source(
          "@vitnode/example",
          { entry: "routes/shared", id: "first" },
          { entry: "routes/shared", id: "second" },
        ),
      ]).map(module => module.specifier),
    ).toEqual([
      "@vitnode/example/routes/shared",
      "@vitnode/example/routes/shared",
    ]);
  });

  it.each([
    ["../../../etc/passwd", "a parent-directory traversal"],
    ["routes/../../secret", "a traversal in the middle"],
    ["/routes/page", "an absolute path"],
    ["./routes/page", "a relative-looking path"],
    ["routes\\page", "a backslash"],
    ["routes/page'", "a quote"],
    ["routes/\npage", "a newline"],
    ["routes/", "a trailing separator"],
    ["", "an empty entry"],
    [" routes/page", "padding"],
  ])("rejects the entry %j - %s", entry => {
    expect(() =>
      resolvePluginRouteModules([
        source("@vitnode/example", { entry, id: "x" }),
      ]),
    ).toThrow(/\[VitNode plugin routes\]/);
  });

  it.each([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"])(
    "rejects an entry ending in %s, because the export map adds the extension",
    extension => {
      expect(() =>
        resolvePluginRouteModules([
          source("@vitnode/example", {
            entry: `routes/page${extension}`,
            id: "page",
          }),
        ]),
      ).toThrow(/file extension/);
    },
  );

  it.each(["../evil", "@scope", "has space", "quote'", "back\\slash", ""])(
    "rejects the plugin id %j",
    pluginId => {
      expect(() =>
        resolvePluginRouteModules([
          source(pluginId, { entry: "routes/page", id: "page" }),
        ]),
      ).toThrow(/not a package name/);
    },
  );

  it.each(["@vitnode/example", "my-plugin", "@scope/nested.plugin_1"])(
    "accepts the plugin id %j",
    pluginId => {
      expect(
        resolvePluginRouteModules([
          source(pluginId, { entry: "routes/page", id: "page" }),
        ])[0].specifier,
      ).toBe(`${pluginId}/routes/page`);
    },
  );

  it.each(["with:colon", "with space", "/leading", "-leading", ""])(
    "rejects the route id %j",
    id => {
      expect(() =>
        resolvePluginRouteModules([
          source("@vitnode/example", { entry: "routes/page", id }),
        ]),
      ).toThrow(/\[VitNode plugin routes\]/);
    },
  );
});

describe("the registry key", () => {
  it("is the manifest layer's own route id, not a second copy of the rule", () => {
    expect(
      resolvePluginRouteModules([
        source("@vitnode/example", {
          entry: "routes/example-page",
          id: "example-page",
        }),
      ])[0].key,
    ).toBe(pluginRouteId("@vitnode/example", "example-page"));
  });
});

describe("sortAndAssertUnique", () => {
  it("compares code units rather than using the machine's collation", () => {
    const modules = ["b", "A", "_", "a", "B"].map(key => ({
      entry: "routes/x",
      key,
      pluginId: "@vitnode/example",
      routeId: key,
      specifier: "@vitnode/example/routes/x",
    }));

    expect(sortAndAssertUnique(modules).map(module => module.key)).toEqual([
      "A",
      "B",
      "_",
      "a",
      "b",
    ]);
  });

  it("does not mutate its argument", () => {
    const modules = ["b", "a"].map(key => ({
      entry: "routes/x",
      key,
      pluginId: "@vitnode/example",
      routeId: key,
      specifier: "@vitnode/example/routes/x",
    }));

    sortAndAssertUnique(modules);

    expect(modules.map(module => module.key)).toEqual(["b", "a"]);
  });
});

describe("toSingleQuotedLiteral", () => {
  it.each([
    ["@vitnode/example/routes/page", "'@vitnode/example/routes/page'"],
    ["it's", "'it\\'s'"],
    ["back\\slash", "'back\\\\slash'"],
    ["line\nbreak", "'line\\nbreak'"],
    ["carriage\rreturn", "'carriage\\rreturn'"],
    ["'); rm -rf /; ('", "'\\'); rm -rf /; (\\''"],
  ])("escapes %j", (value, expected) => {
    expect(toSingleQuotedLiteral(value)).toBe(expected);
  });

  it("produces a literal that evaluates back to the original", () => {
    for (const value of ["a'b", "a\\b", "a\\'b", "a\nb"]) {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      expect(new Function(`return ${toSingleQuotedLiteral(value)}`)()).toBe(
        value,
      );
    }
  });
});

describe("pluginIdsFromLoadedConfig", () => {
  it("reads the configured plugin ids in the configured order", () => {
    expect(
      pluginIdsFromLoadedConfig(
        {
          vitNodeConfig: {
            plugins: [
              { pluginId: "@vitnode/blog" },
              { pluginId: "@vitnode/example" },
            ],
          },
        },
        "src/vitnode.config.ts",
      ),
    ).toEqual(["@vitnode/blog", "@vitnode/example"]);
  });

  it("accepts an app with no plugins", () => {
    expect(
      pluginIdsFromLoadedConfig(
        { vitNodeConfig: { plugins: [] } },
        "src/vitnode.config.ts",
      ),
    ).toEqual([]);
  });

  it.each([
    [undefined, /does not export/],
    [{}, /does not export/],
    [{ vitNodeConfig: null }, /does not export/],
    [{ vitNodeConfig: {} }, /is not an array/],
    [{ vitNodeConfig: { plugins: "blog" } }, /is not an array/],
    [{ vitNodeConfig: { plugins: [{}] } }, /has no string `pluginId`/],
    [{ vitNodeConfig: { plugins: [null] } }, /has no string `pluginId`/],
    [{ vitNodeConfig: { plugins: [{ pluginId: 1 }] } }, /has no string/],
  ])("rejects %j", (loaded, message) => {
    expect(() =>
      pluginIdsFromLoadedConfig(loaded, "src/vitnode.config.ts"),
    ).toThrow(message);
  });

  it("names the offending index", () => {
    expect(() =>
      pluginIdsFromLoadedConfig(
        { vitNodeConfig: { plugins: [{ pluginId: "@vitnode/blog" }, {}] } },
        "src/vitnode.config.ts",
      ),
    ).toThrow(/plugins\[1\]/);
  });

  it("rejects a configured id that is not a package name", () => {
    expect(() =>
      pluginIdsFromLoadedConfig(
        { vitNodeConfig: { plugins: [{ pluginId: "../evil" }] } },
        "src/vitnode.config.ts",
      ),
    ).toThrow(/not a package name/);
  });
});

describe("routeDeclarationsFromManifest", () => {
  it("reads only the id and the entry, ignoring everything else", () => {
    expect(
      routeDeclarationsFromManifest(
        {
          routes: [
            {
              entry: "routes/example-page",
              id: "example-page",
              path: "/example",
              permissions: ["staff"],
            },
          ],
        },
        "@vitnode/example/routes/manifest",
      ),
    ).toEqual([{ entry: "routes/example-page", id: "example-page" }]);
  });

  it("accepts a manifest declaring no routes", () => {
    expect(
      routeDeclarationsFromManifest({ routes: [] }, "@x/y/routes/manifest"),
    ).toEqual([]);
  });

  it.each([
    [undefined, /does not export `routes`/],
    [{}, /does not export `routes`/],
    [{ routes: {} }, /is not an array/],
    [{ routes: [{ id: "a" }] }, /is not a `\{ id: string, entry: string \}`/],
    [{ routes: [{ entry: "routes/a" }] }, /is not a/],
    [{ routes: ["routes/a"] }, /is not a/],
  ])("rejects %j", (loaded, message) => {
    expect(() =>
      routeDeclarationsFromManifest(loaded, "@x/y/routes/manifest"),
    ).toThrow(message);
  });
});

describe("pluginRouteEntrySources", () => {
  const built = (pluginId: string, routeId: string): PluginRoute => ({
    area: "main",
    entry: `routes/${routeId}`,
    id: `${pluginId}:${routeId}`,
    kind: "page",
    namespaces: [],
    parentId: null,
    path: `/${routeId}`,
    pluginId,
    requires: null,
    routeId,
    searchEntry: null,
    segments: [{ kind: "static", value: routeId }],
  });

  it("turns a built manifest back into per-plugin declarations", () => {
    expect(
      pluginRouteEntrySources([
        built("@vitnode/example", "a"),
        built("@vitnode/blog", "b"),
        built("@vitnode/example", "c"),
      ]),
    ).toEqual([
      {
        pluginId: "@vitnode/example",
        routes: [
          { entry: "routes/a", id: "a" },
          { entry: "routes/c", id: "c" },
        ],
      },
      { pluginId: "@vitnode/blog", routes: [{ entry: "routes/b", id: "b" }] },
    ]);
  });

  it("rebuilds the global id the manifest already gave the route", () => {
    // The join between the two generated files: a module is registered under
    // exactly the id the manifest addresses the route by, by construction
    // rather than by two layers agreeing on a format.
    const manifest = [built("@vitnode/example", "a")];

    expect(
      resolvePluginRouteModules(pluginRouteEntrySources(manifest)).map(
        module => module.key,
      ),
    ).toEqual(manifest.map(route => route.id));
  });

  it("has nothing to say about a manifest with no routes", () => {
    expect(pluginRouteEntrySources([])).toEqual([]);
  });
});
