// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { PluginRoute } from "../../routing/types.js";
import type { ResolvedPluginRouteModule } from "./types.js";

import { assertPluginRouteRegistryParity } from "./parity.js";

const route = (routeId: string, entry = `routes/${routeId}`): PluginRoute => ({
  area: "main",
  entry,
  id: `@vitnode/example:${routeId}`,
  kind: "page",
  namespaces: [],
  parentId: null,
  path: `/${routeId}`,
  pluginId: "@vitnode/example",
  requires: null,
  routeId,
  segments: [{ kind: "static", value: routeId }],
});

const module = (
  routeId: string,
  entry = `routes/${routeId}`,
): ResolvedPluginRouteModule => ({
  entry,
  key: `@vitnode/example:${routeId}`,
  pluginId: "@vitnode/example",
  routeId,
  specifier: `@vitnode/example/${entry}`,
});

describe("assertPluginRouteRegistryParity", () => {
  it("passes when both files describe the same routes", () => {
    expect(() =>
      assertPluginRouteRegistryParity(
        [route("a"), route("b")],
        [module("a"), module("b")],
      ),
    ).not.toThrow();
  });

  it("passes for an app with no plugin routes at all", () => {
    expect(() => assertPluginRouteRegistryParity([], [])).not.toThrow();
  });

  it("rejects a manifest route with no module - a page with no code", () => {
    expect(() =>
      assertPluginRouteRegistryParity([route("a"), route("b")], [module("a")]),
    ).toThrow("@vitnode/example:b");
  });

  it("rejects an orphaned module - code nothing can reach", () => {
    expect(() =>
      assertPluginRouteRegistryParity([route("a")], [module("a"), module("b")]),
    ).toThrow("not in the route manifest: @vitnode/example:b");
  });

  it("rejects one id describing two different entries", () => {
    // The drift that would load one plugin's component for another's URL.
    expect(() =>
      assertPluginRouteRegistryParity(
        [route("a", "routes/a")],
        [module("a", "routes/somewhere-else")],
      ),
    ).toThrow("disagree about @vitnode/example:a");
  });

  it("names the failure as the generator's rather than a plugin's", () => {
    // Both files are written from one resolved manifest, so nothing a plugin
    // author can write reaches this - and the message should say so instead of
    // sending them to look at their own route declarations.
    expect(() => assertPluginRouteRegistryParity([route("a")], [])).toThrow(
      "a bug in the generator",
    );
  });
});
