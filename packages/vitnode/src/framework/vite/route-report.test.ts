import { describe, expect, it } from "vitest";

import type { PluginRoute } from "@/routing/types";

import { resolvePageCacheRoutes } from "@/page-cache/resolve";
import { parseRoutePath } from "@/routing/path";

import { buildRouteReport } from "./route-report";

const pluginRoute = (
  path: string,
  kind: PluginRoute["kind"] = "page",
): PluginRoute => {
  const parsed = parseRoutePath(path);
  if (!parsed.ok) throw new Error(`invalid test path ${path}`);

  return {
    area: "main",
    id: `@vitnode/core:${path}`,
    kind,
    messages: [],
    parentId: null,
    path: parsed.path,
    pluginId: "@vitnode/core",
    requires: null,
    routeId: path,
    segments: parsed.segments,
  };
};

const hostRoute = (path: string) => ({ file: `src/routes${path}.tsx`, path });

const i18n = {
  defaultLocale: "en",
  locales: [
    { code: "en", name: "English" },
    { code: "pl", name: "Polski" },
  ],
  routePaths: { pl: { "/discover": "/odkrywaj" } },
};

const report = (htmlPaths: string[]) =>
  buildRouteReport({
    hostRoutes: [
      hostRoute("/"),
      hostRoute("/plugins"),
      hostRoute("/solutions/$slug"),
      hostRoute("/api/$"),
    ],
    htmlPaths,
    i18n,
    pluginRoutes: [
      pluginRoute("/discover"),
      pluginRoute("/login"),
      pluginRoute("/settings", "layout"),
    ],
  });

const entry = (htmlPaths: string[], path: string) =>
  report(htmlPaths).find(candidate => candidate.path === path);

describe("buildRouteReport", () => {
  it("calls a route static once every language has a file", () => {
    expect(entry(["/plugins", "/pl/plugins"], "/plugins")).toEqual({
      cache: null,
      localizedPaths: [],
      mode: "static",
      path: "/plugins",
      staticPaths: ["/plugins", "/pl/plugins"],
    });
  });

  it("calls a route partly static when one language still renders on demand", () => {
    expect(entry(["/plugins"], "/plugins")?.mode).toBe("partial");
  });

  it("files a translated path under the route it translates", () => {
    expect(entry(["/discover", "/pl/odkrywaj"], "/discover")).toEqual({
      cache: null,
      localizedPaths: [],
      mode: "static",
      path: "/discover",
      staticPaths: ["/discover", "/pl/odkrywaj"],
    });
  });

  it("lists the prerendered values of a route with a parameter", () => {
    expect(
      entry(
        [
          "/pl/solutions/help-center",
          "/pl/solutions/gaming-guild",
          "/solutions/help-center",
          "/solutions/gaming-guild",
        ],
        "/solutions/:slug",
      ),
    ).toEqual({
      cache: null,
      localizedPaths: [],
      mode: "partial",
      path: "/solutions/:slug",
      staticPaths: [
        "/solutions/gaming-guild",
        "/pl/solutions/gaming-guild",
        "/solutions/help-center",
        "/pl/solutions/help-center",
      ],
    });
  });

  it("prefers the route with fixed segments over one with a parameter", () => {
    expect(entry(["/plugins"], "/solutions/:slug")?.staticPaths).toEqual([]);
  });

  it("gives a file to the exact route before a catch-all below it", () => {
    const [docs] = buildRouteReport({
      hostRoutes: [hostRoute("/docs"), hostRoute("/docs/$")],
      htmlPaths: ["/docs", "/pl/docs"],
      i18n,
      pluginRoutes: [],
    });

    expect(docs).toEqual({
      cache: null,
      localizedPaths: [],
      mode: "static",
      path: "/docs",
      staticPaths: ["/docs", "/pl/docs"],
    });
  });

  it("reports routes without a file as rendered on demand", () => {
    expect(entry([], "/login")?.mode).toBe("dynamic");
    expect(entry([], "/api/*")?.mode).toBe("dynamic");
  });

  it("leaves layouts out, since they are not pages", () => {
    expect(entry([], "/settings")).toBeUndefined();
  });

  it("still reports a static file no route claims", () => {
    expect(entry(["/404"], "/404")).toEqual({
      cache: null,
      localizedPaths: [],
      mode: "static",
      path: "/404",
      staticPaths: ["/404"],
    });
  });

  describe("page cache", () => {
    const POLICY = { maxAge: 300, staleWhileRevalidate: 60 };

    const cached = (routes: Record<string, false | typeof POLICY> = {}) => {
      const pluginRoutes = [
        { ...pluginRoute("/blog/:slug"), cache: POLICY },
        { ...pluginRoute("/discover"), cache: POLICY },
      ];

      return buildRouteReport({
        hostRoutes: [],
        htmlPaths: [],
        i18n: {
          ...i18n,
          routePaths: {
            pl: { "/blog/:slug": "/wpisy/:slug", "/discover": "/odkrywaj" },
          },
        },
        pageCacheRoutes: resolvePageCacheRoutes({
          config: { enabled: true, routes, storage: "memory" },
          hostRoutes: [],
          pluginRoutes,
        }),
        pluginRoutes,
      });
    };

    it("reports a cached route's policy and the patterns other locales use", () => {
      expect(
        cached().find(candidate => candidate.path === "/blog/:slug"),
      ).toEqual({
        cache: { policy: POLICY, source: "route" },
        localizedPaths: ["/pl/wpisy/:slug"],
        mode: "dynamic",
        path: "/blog/:slug",
        staticPaths: [],
      });
    });

    it("credits the host app with an override that turned caching off", () => {
      expect(
        cached({ "/discover": false }).find(
          candidate => candidate.path === "/discover",
        ),
      ).toMatchObject({
        cache: { policy: null, source: "host" },
        localizedPaths: [],
      });
    });
  });
});
