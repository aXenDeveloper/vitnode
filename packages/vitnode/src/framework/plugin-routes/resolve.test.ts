// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  assertPluginId,
  pluginIdsFromLoadedConfig,
  routeDeclarationsFromRoutesModule,
  sortAndAssertUniquePlugins,
  toSingleQuotedLiteral,
} from "./resolve.js";

/**
 * The part of the build that turns configuration into strings a generated file
 * can contain.
 *
 * Everything here is pure, and everything here is a *string* going into a source
 * file - which is why the validation is as strict as it is: a plugin id is
 * concatenated into an import specifier, and an id nobody checked is an app
 * whose generated source says whatever a `package.json` did.
 */
describe("sortAndAssertUniquePlugins", () => {
  it("orders by plugin id, not by configuration order", () => {
    expect(
      sortAndAssertUniquePlugins([
        { pluginId: "@vitnode/example", specifier: "@vitnode/example/routes" },
        { pluginId: "@acme/blog", specifier: "@acme/blog/routes" },
      ]).map(module => module.pluginId),
    ).toEqual(["@acme/blog", "@vitnode/example"]);
  });

  it("compares code units rather than using the machine's collation", () => {
    // `localeCompare` sorts "a" before "B"; a build has to be reproducible.
    expect(
      sortAndAssertUniquePlugins([
        { pluginId: "a-plugin", specifier: "a-plugin/routes" },
        { pluginId: "B-plugin", specifier: "B-plugin/routes" },
      ]).map(module => module.pluginId),
    ).toEqual(["B-plugin", "a-plugin"]);
  });

  it("does not mutate its argument", () => {
    const modules = [
      { pluginId: "b", specifier: "b/routes" },
      { pluginId: "a", specifier: "a/routes" },
    ];

    sortAndAssertUniquePlugins(modules);

    expect(modules.map(module => module.pluginId)).toEqual(["b", "a"]);
  });

  it("rejects the same plugin configured twice", () => {
    expect(() =>
      sortAndAssertUniquePlugins([
        { pluginId: "@acme/blog", specifier: "@acme/blog/routes" },
        { pluginId: "@acme/blog", specifier: "@acme/blog/routes" },
      ]),
    ).toThrow(/Two plugins claim the same id: "@acme\/blog"/);
  });

  it("has nothing to say about no plugins at all", () => {
    expect(sortAndAssertUniquePlugins([])).toEqual([]);
  });
});

describe("assertPluginId", () => {
  it.each(["@vitnode/example", "my-plugin", "a.b_c-d", "@a/b.c"])(
    "accepts %s, which npm does",
    pluginId => {
      expect(assertPluginId(pluginId, "vitnode.config.ts")).toBe(pluginId);
    },
  );

  it.each([
    "../escape",
    "with space",
    "quote'd",
    "back\\slash",
    "",
    "@scope",
    "@scope/",
  ])("rejects %j, which an import specifier may not contain", pluginId => {
    expect(() => assertPluginId(pluginId, "vitnode.config.ts")).toThrow(
      /which is not a package name/,
    );
  });
});

describe("toSingleQuotedLiteral", () => {
  it.each([
    ["plain", "'plain'"],
    ["it's", "'it\\'s'"],
    ["back\\slash", "'back\\\\slash'"],
    ["line\nbreak", "'line\\nbreak'"],
  ])("escapes %j", (value, expected) => {
    expect(toSingleQuotedLiteral(value)).toBe(expected);
  });

  it("produces a literal that evaluates back to the original", () => {
    const value = "a'b\\c\nd";

    expect(eval(toSingleQuotedLiteral(value))).toBe(value);
  });
});

describe("pluginIdsFromLoadedConfig", () => {
  it("reads the configured plugin ids in the configured order", () => {
    expect(
      pluginIdsFromLoadedConfig(
        {
          vitNodeConfig: {
            plugins: [
              { pluginId: "@vitnode/example" },
              { pluginId: "@acme/blog" },
            ],
          },
        },
        "src/vitnode.config.ts",
      ),
    ).toEqual(["@vitnode/example", "@acme/blog"]);
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
    [undefined, /does not export `vitNodeConfig`/],
    [{}, /does not export `vitNodeConfig`/],
    [{ vitNodeConfig: {} }, /is not an array/],
    [{ vitNodeConfig: { plugins: "nope" } }, /is not an array/],
  ])("rejects %j", (loaded, message) => {
    expect(() =>
      pluginIdsFromLoadedConfig(loaded, "src/vitnode.config.ts"),
    ).toThrow(message);
  });

  it("names the offending index", () => {
    expect(() =>
      pluginIdsFromLoadedConfig(
        { vitNodeConfig: { plugins: [{ pluginId: "ok" }, {}] } },
        "src/vitnode.config.ts",
      ),
    ).toThrow(/`vitNodeConfig\.plugins\[1\]`/);
  });

  it("rejects a configured id that is not a package name", () => {
    expect(() =>
      pluginIdsFromLoadedConfig(
        { vitNodeConfig: { plugins: [{ pluginId: "../evil" }] } },
        "src/vitnode.config.ts",
      ),
    ).toThrow(/which is not a package name/);
  });
});

describe("routeDeclarationsFromRoutesModule", () => {
  it("hands the tree on untouched", () => {
    const routes = [{ anything: true }];

    expect(
      routeDeclarationsFromRoutesModule({ routes }, "@acme/blog/routes"),
    ).toBe(routes);
  });

  it("accepts a module declaring no routes", () => {
    expect(
      routeDeclarationsFromRoutesModule({ routes: [] }, "@acme/blog/routes"),
    ).toEqual([]);
  });

  it.each([undefined, {}, { default: [] }])(
    "rejects a module that exports no `routes` (%j)",
    loaded => {
      expect(() =>
        routeDeclarationsFromRoutesModule(loaded, "@acme/blog/routes"),
      ).toThrow(/does not export `routes`/);
    },
  );

  it("rejects a `routes` that is not an array", () => {
    expect(() =>
      routeDeclarationsFromRoutesModule(
        { routes: { nope: true } },
        "@acme/blog/routes",
      ),
    ).toThrow(/`routes` in @acme\/blog\/routes is not an array/);
  });

  /**
   * The one migration this build can recognise, and the reason it is worth
   * recognising: the flat manifest's `entry` was a string the *app* imported,
   * and a page is now named by the plugin's own `lazy(() => import(...))`. There
   * is no adapter that could turn one into the other, so the shape is named
   * rather than half-supported.
   */
  it("names the old flat manifest rather than failing later", () => {
    expect(() =>
      routeDeclarationsFromRoutesModule(
        {
          routes: [
            { entry: "routes/home-page", id: "home", path: "/blog" },
            { entry: "routes/post-page", id: "post", path: "/blog/:slug" },
          ],
        },
        "@acme/blog/routes",
      ),
    ).toThrow(
      /exports the old flat route manifest - 2 routes declaring an `entry`/,
    );
  });
});
