// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { PluginRoute } from "./routing";

import { routes } from "./routes";
import { compilePluginRouteTrees, routeMatchKey } from "./routing";

const manifest = compilePluginRouteTrees([
  { pluginId: "@vitnode/core", routes },
]).manifest;

const pathsIn = (area: PluginRoute["area"]) =>
  manifest.filter(route => route.area === area).map(route => route.path);

const source = readFileSync(join(__dirname, "routes.tsx"), "utf8");

/**
 * Core's route tree, held to the promises its hand-built route modules used to
 * make in three separate directories.
 *
 * Asserted against the *compiled manifest* rather than the file's text, which is
 * what the directory this replaced could not do: a grep for `path:` can tell you
 * a string appears, and this can tell you which URLs are actually claimed, by
 * which shell, behind which guard.
 */
describe("core's route tree", () => {
  it("compiles", () => {
    expect(manifest.length).toBeGreaterThan(20);
  });

  /**
   * The check the old `admin-routes.test.ts` made by reading source text: every
   * AdminCP screen spells its full public URL, so a reader can take the URL from
   * the address bar and grep their way to the route that answers it.
   */
  it("spells every admin route's full path", () => {
    for (const path of pathsIn("admin")) {
      expect(path.startsWith("/admin/")).toBe(true);
    }
  });

  /**
   * `/admin/core` is the AdminCP's landing page and belongs to the application -
   * the one admin URL core deliberately does not claim, so an app decides what
   * its own dashboard says.
   */
  it("leaves /admin/core to the application", () => {
    expect(pathsIn("admin")).not.toContain("/admin/core");
  });

  /**
   * The AdminCP's sign-in page is the one core screen outside every shell: it is
   * where somebody lands *because* they have no admin session, so it cannot
   * render inside the shell that requires one.
   */
  it("puts the AdminCP sign-in page outside every shell", () => {
    expect(pathsIn("blank")).toEqual(["/admin"]);
    expect(manifest.find(route => route.path === "/admin")?.requires).toBe(
      "admin-guest",
    );
  });

  it("claims each URL exactly once", () => {
    const keys = manifest.map(
      route => `${route.kind} ${routeMatchKey(route.segments)}`,
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  /** One catch-all, and it is the Content Engine's. */
  it("declares exactly one catch-all", () => {
    const splats = manifest.filter(route =>
      route.segments.some(segment => segment.kind === "splat"),
    );

    expect(splats.map(route => route.path)).toEqual(["/admin/content/*"]);
  });

  /**
   * A guard is a declaration here rather than code in a route module, which is
   * what lets one implementation answer for every route making the same promise.
   */
  it("guards the screens that need a session, and only those", () => {
    const guarded = Object.fromEntries(
      manifest
        .filter(route => route.requires !== null)
        .map(route => [route.path, route.requires]),
    );

    expect(guarded).toEqual({
      "/admin": "admin-guest",
      "/files": "authenticated",
      "/login": "guest",
      "/register": "guest",
      "/settings": "authenticated",
    });
  });

  /**
   * No admin route declares `requires`: the AdminCP has its own session, and a
   * route in that area already renders behind the shell's guard. Per-screen
   * staff permissions are checked in each loader instead, where the tuple lives.
   */
  it("leaves the admin area's session to the AdminCP shell", () => {
    for (const route of manifest) {
      if (route.area === "admin") expect(route.requires).toBeNull();
    }
  });

  /**
   * The tree is data a build tool reads in Node before any bundler runs. A page
   * imported here rather than named through `lazy()` would be in the initial
   * bundle, and a React import would make the file unreadable to that tool.
   */
  it("reaches every screen through a lazy import and nothing else", () => {
    const statically = [
      ...source.matchAll(/^import [\s\S]*?from "([^"]+)";$/gm),
    ].map(([, specifier]) => specifier);
    const lazily = [...source.matchAll(/import\("([^"]+)"\)/g)].map(
      ([, specifier]) => specifier,
    );

    // What is imported up front is a search validator, a namespace list or the
    // authoring vocabulary itself - values a route is made of. Nothing that
    // renders.
    expect(
      statically.some(specifier => /-page$|-layout$/.test(specifier)),
    ).toBe(false);
    expect(statically).not.toContain("react");

    // ...and every screen is behind one, in `src/pages/` - the same place a
    // plugin keeps its own, so there is one answer to "where do pages live".
    expect(lazily.length).toBe(manifest.length);
    expect(lazily.every(specifier => specifier.startsWith("./pages/"))).toBe(
      true,
    );
  });
});
