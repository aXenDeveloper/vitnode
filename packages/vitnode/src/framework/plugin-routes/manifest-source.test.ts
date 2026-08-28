import { describe, expect, it } from "vitest";

import { buildPluginRouteManifest } from "../../routing/manifest";
import { generatePluginRouteManifestSource } from "./manifest-source";

const manifestOf = (
  ...sources: { pluginId: string; routes: { entry: string; path: string }[] }[]
) =>
  buildPluginRouteManifest(
    sources.map(source => ({
      pluginId: source.pluginId,
      routes: source.routes.map((route, index) => ({
        entry: route.entry,
        id: `route-${index}`,
        path: route.path,
      })),
    })),
  );

describe("generatePluginRouteManifestSource", () => {
  it("emits an empty manifest an app can still import", () => {
    const source = generatePluginRouteManifestSource([]);

    expect(source).toContain("export const pluginRouteManifest = []");
    expect(source).toContain("satisfies readonly PluginRoute[]");
    expect(source).toContain("import type { PluginRoute } from");
  });

  it("emits every field of a route, and its parsed segments", () => {
    const source = generatePluginRouteManifestSource(
      manifestOf({
        pluginId: "@vitnode/example",
        routes: [{ entry: "routes/article", path: "/example/:slug" }],
      }),
    );

    expect(source).toContain("area: 'main',");
    expect(source).toContain("entry: 'routes/article',");
    expect(source).toContain("id: '@vitnode/example:route-0',");
    expect(source).toContain("path: '/example/:slug',");
    expect(source).toContain("pluginId: '@vitnode/example',");
    expect(source).toContain("routeId: 'route-0',");
    expect(source).toContain(
      "segments: [{ kind: 'static', value: 'example' }, { kind: 'param', name: 'slug' }],",
    );
  });

  it("emits a root route as an empty segment list", () => {
    const source = generatePluginRouteManifestSource(
      manifestOf({
        pluginId: "landing",
        routes: [{ entry: "routes/home", path: "/" }],
      }),
    );

    expect(source).toContain("path: '/',");
    expect(source).toContain("segments: [],");
  });

  /**
   * The property the whole "generate a file into `src/`" approach rests on: the
   * bytes depend on the configuration and nothing else. If they depended on the
   * order plugins happen to load in, the file would churn between developers and
   * the dev server would reload in a loop on every restart.
   */
  it("produces the same bytes whatever order the plugins are read in", () => {
    const a = { pluginId: "a-plugin", routes: [{ entry: "r/a", path: "/a" }] };
    const b = { pluginId: "b-plugin", routes: [{ entry: "r/b", path: "/b" }] };

    expect(generatePluginRouteManifestSource(manifestOf(a, b))).toBe(
      generatePluginRouteManifestSource(manifestOf(b, a)),
    );
  });

  it("sorts routes even when handed a manifest out of order", () => {
    const [a, b] = manifestOf({
      pluginId: "plugin",
      routes: [
        { entry: "r/z", path: "/z" },
        { entry: "r/a", path: "/a" },
      ],
    });

    expect(generatePluginRouteManifestSource([b, a])).toBe(
      generatePluginRouteManifestSource([a, b]),
    );
    expect(
      generatePluginRouteManifestSource([b, a]).indexOf("path: '/a',"),
    ).toBeLessThan(
      generatePluginRouteManifestSource([b, a]).indexOf("path: '/z',"),
    );
  });

  /**
   * The file is written into an app's `src/`, so nothing that reaches it may be
   * able to close a string literal. Every value has already been matched against
   * a pattern that cannot contain a quote - this asserts the generator does not
   * rely on that being true forever.
   */
  it("escapes what it writes", () => {
    const source = generatePluginRouteManifestSource([
      {
        area: "main",
        entry: "routes/x",
        id: "p:x",
        path: "/x",
        pluginId: "p",
        routeId: "x",
        segments: [{ kind: "static", value: "it's" }],
      },
    ]);

    expect(source).toContain("{ kind: 'static', value: 'it\\'s' }");
  });
});
