// @vitest-environment node
import { describe, expect, it } from "vitest";

import { CORE_PLUGIN_ID, CORE_ROUTES_SPECIFIER } from "./core.js";
import { assertPluginId } from "./resolve.js";

/**
 * Core reaches the route registry as a *source*, the same way a plugin does, and
 * these are the two halves of that: the id it is registered under, and the
 * specifier its tree is imported from.
 *
 * Both are spelled out rather than derived, because the generator must not load
 * an application's configuration to know them - core is not in it.
 */
describe("core as a route source", () => {
  it("is registered under core's own package name", () => {
    expect(CORE_PLUGIN_ID).toBe("@vitnode/core");
  });

  /**
   * The same `<pluginId>/routes` shape every plugin's tree is read from, so the
   * resolver, the watcher and the generated import all treat core as one more
   * source rather than as a special case they each have to remember.
   */
  it("is imported from the same subpath a plugin's routes are", () => {
    expect(CORE_ROUTES_SPECIFIER).toBe(`${CORE_PLUGIN_ID}/routes`);
  });

  /**
   * Core's routes are prepended to every application's registry, so a plugin
   * claiming this id would put two sources under one name. The duplicate check
   * downstream would then blame the application's configuration for a source
   * VitNode added itself, which is a confusing way to learn this.
   */
  it("refuses a configured plugin that claims core's id", () => {
    expect(() =>
      assertPluginId(CORE_PLUGIN_ID, "src/vitnode.config.ts"),
    ).toThrow(
      /claims the id "@vitnode\/core", which is core's own|configures a plugin with the id "@vitnode\/core"/,
    );
  });

  it("still accepts a plugin published under the same scope", () => {
    expect(assertPluginId("@vitnode/blog", "src/vitnode.config.ts")).toBe(
      "@vitnode/blog",
    );
  });
});
