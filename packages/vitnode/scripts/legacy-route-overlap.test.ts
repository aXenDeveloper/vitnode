import { describe, expect, it } from "vitest";

import {
  LEGACY_ROUTE_DIRECTORIES,
  legacyRouteOverlaps,
  legacyRouteOverlapWarning,
} from "./legacy-route-overlap.js";

const plugin = (...entries: string[]) => [
  {
    pluginId: "@vitnode/example",
    routes: entries.map((entry, index) => ({ entry, id: `route-${index}` })),
  },
];

describe("legacyRouteOverlaps", () => {
  it("says nothing about the naming the docs recommend", () => {
    expect(
      legacyRouteOverlaps(plugin("routes/example-page", "routes/guide-layout")),
    ).toEqual([]);
  });

  it("does not mistake a prefix for a directory", () => {
    // `routes/main-page` is a file called main-page, not a file inside `main`.
    expect(legacyRouteOverlaps(plugin("routes/main-page"))).toEqual([]);
    expect(legacyRouteOverlaps(plugin("routes/administration"))).toEqual([]);
    // A module called `main.tsx` beside the `main/` directory, not inside it.
    expect(legacyRouteOverlaps(plugin("routes/main"))).toEqual([]);
    // The copier only ever descends into `src/routes/`.
    expect(legacyRouteOverlaps(plugin("views/admin/panel"))).toEqual([]);
  });

  it.each(LEGACY_ROUTE_DIRECTORIES)(
    "flags an entry under routes/%s",
    directory => {
      expect(legacyRouteOverlaps(plugin(`routes/${directory}/page`))).toEqual([
        {
          directory,
          entry: `routes/${directory}/page`,
          pluginId: "@vitnode/example",
          routeId: "route-0",
        },
      ]);
    },
  );

  it("reads a plugin that declares no routes at all", () => {
    // Most plugins are AdminCP content types and ship no pages.
    expect(legacyRouteOverlaps([{ pluginId: "@vitnode/blog" }])).toEqual([]);
  });

  it("ignores a malformed entry rather than throwing on it", () => {
    // Plugin configuration is hand-written JavaScript by the time it reaches
    // here, and rejecting it is `buildPluginRouteManifest`'s job - a warning
    // that crashed the build would be worse than the thing it warns about.
    expect(
      legacyRouteOverlaps([
        { pluginId: "@vitnode/example", routes: [{ entry: 7, id: "x" }] },
      ]),
    ).toEqual([]);
  });
});

describe("legacyRouteOverlapWarning", () => {
  it("says nothing when there is nothing to say", () => {
    expect(legacyRouteOverlapWarning([])).toBeNull();
  });

  it("names the plugin, the route and the entry", () => {
    const warning = legacyRouteOverlapWarning(
      legacyRouteOverlaps(plugin("routes/admin/dashboard")),
    );

    expect(warning).toContain("@vitnode/example");
    expect(warning).toContain('route "route-0"');
    expect(warning).toContain('entry "routes/admin/dashboard"');
    expect(warning).toContain("Move the module out of that directory");
  });
});
