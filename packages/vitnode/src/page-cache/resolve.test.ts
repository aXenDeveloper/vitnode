import { describe, expect, it } from "vitest";

import type { PluginRoute } from "../routing/types";
import type { ResolvedPageCacheConfig } from "./config";
import type { PageCacheSetting } from "./policy";
import type { PageCacheHostRoute } from "./resolve";

import { parseRoutePath } from "../routing/path";
import { createPageCacheMatcher } from "./match";
import { PageCachePolicyError } from "./policy";
import { pageCacheRouteTable, resolvePageCacheRoutes } from "./resolve";

const segmentsOf = (path: string) => {
  const parsed = parseRoutePath(path);
  if (!parsed.ok) throw new Error(`invalid test path ${path}`);

  return parsed;
};

const pluginRoute = (
  path: string,
  extra: Partial<PluginRoute> & { cache?: PageCacheSetting } = {},
): PluginRoute => {
  const parsed = segmentsOf(path);

  return {
    area: "main",
    id: `@acme/blog:page#${path}`,
    kind: "page",
    messages: [],
    parentId: null,
    path: parsed.path,
    pluginId: "@acme/blog",
    requires: null,
    routeId: `page#${path}`,
    segments: parsed.segments,
    ...extra,
  };
};

const hostRoute = (path: string): PageCacheHostRoute => ({
  file: `src/routes${path}.tsx`,
  segments: segmentsOf(path).segments,
});

const config = (
  overrides: Partial<ResolvedPageCacheConfig> = {},
): ResolvedPageCacheConfig => ({
  enabled: true,
  routes: {},
  storage: "memory",
  ...overrides,
});

const POLICY = { maxAge: 300, staleWhileRevalidate: 60 };

const resolve = ({
  hostRoutes = [],
  pluginRoutes = [],
  settings = config(),
}: {
  hostRoutes?: PageCacheHostRoute[];
  pluginRoutes?: PluginRoute[];
  settings?: ResolvedPageCacheConfig;
}) =>
  Object.fromEntries(
    resolvePageCacheRoutes({ config: settings, hostRoutes, pluginRoutes }).map(
      route => [route.path, { policy: route.policy, source: route.source }],
    ),
  );

describe("resolvePageCacheRoutes", () => {
  it("leaves a route uncached unless something declares a policy", () => {
    expect(
      resolve({
        hostRoutes: [hostRoute("/about")],
        pluginRoutes: [
          pluginRoute("/blog"),
          pluginRoute("/blog/:slug", { cache: POLICY }),
        ],
      }),
    ).toEqual({
      "/about": { policy: null, source: null },
      "/blog": { policy: null, source: null },
      "/blog/:slug": { policy: POLICY, source: "route" },
    });
  });

  it.each<[string, PageCacheSetting, ReturnType<typeof resolve>[string]]>([
    ["replaces", { maxAge: 30 }, { policy: { maxAge: 30 }, source: "host" }],
    ["disables", false, { policy: null, source: "host" }],
  ])(
    "lets the host app's override %s a plugin's policy",
    (_, setting, expected) => {
      expect(
        resolve({
          pluginRoutes: [pluginRoute("/blog/:slug", { cache: POLICY })],
          settings: config({ routes: { "/blog/:id": setting } }),
        })["/blog/:slug"],
      ).toEqual(expected);
    },
  );

  it("lets the host app opt one of its own routes in", () => {
    expect(
      resolve({
        hostRoutes: [hostRoute("/about")],
        settings: config({ routes: { "/about": { maxAge: 60 } } }),
      })["/about"],
    ).toEqual({ policy: { maxAge: 60 }, source: "host" });
  });

  it("refuses an override for a path that is not a page route", () => {
    expect(() =>
      resolve({
        pluginRoutes: [pluginRoute("/blog/:slug", { cache: POLICY })],
        settings: config({ routes: { "/blgo/:slug": { maxAge: 60 } } }),
      }),
    ).toThrow(PageCachePolicyError);
  });

  it.each([
    [
      "an AdminCP route",
      {
        pluginRoutes: [
          pluginRoute("/admin/stats", { area: "admin", cache: POLICY }),
        ],
      },
    ],
    [
      "a route that requires a session",
      {
        pluginRoutes: [
          pluginRoute("/account", { cache: POLICY, requires: "authenticated" }),
        ],
      },
    ],
    [
      "a route under a layout that requires a session",
      {
        pluginRoutes: [
          pluginRoute("/account", {
            id: "@acme/blog:layout#/account",
            kind: "layout",
            requires: "authenticated",
          }),
          pluginRoute("/account/feed", {
            cache: POLICY,
            parentId: "@acme/blog:layout#/account",
          }),
        ],
      },
    ],
    [
      "an /api path, through a host override",
      {
        hostRoutes: [hostRoute("/api/status")],
        settings: config({ routes: { "/api/status": { maxAge: 60 } } }),
      },
    ],
  ])("refuses a policy on %s", (_, input) => {
    expect(() => resolve(input)).toThrow(PageCachePolicyError);
  });

  it("allows `false` on a route that may never be cached", () => {
    expect(
      resolve({
        pluginRoutes: [pluginRoute("/account", { requires: "authenticated" })],
        settings: config({ routes: { "/account": false } }),
      })["/account"],
    ).toEqual({ policy: null, source: "host" });
  });

  it("caches nothing when the host app turns the cache off", () => {
    expect(
      resolve({
        pluginRoutes: [pluginRoute("/blog/:slug", { cache: POLICY })],
        settings: config({ enabled: false }),
      })["/blog/:slug"],
    ).toEqual({ policy: null, source: "route" });
  });
});

describe("createPageCacheMatcher", () => {
  const match = createPageCacheMatcher(
    pageCacheRouteTable(
      resolvePageCacheRoutes({
        config: config(),
        hostRoutes: [hostRoute("/docs/*")],
        pluginRoutes: [
          pluginRoute("/blog/:slug", { cache: POLICY }),
          pluginRoute("/blog/new"),
          pluginRoute("/docs/intro", { cache: { maxAge: 60 } }),
        ],
      }),
    ),
  );

  it.each([
    ["/blog/hello", "/blog/:slug", POLICY],
    ["/blog/new", "/blog/new", null],
    ["/BLOG/hello", "/blog/:slug", POLICY],
    ["/blog/caf%C3%A9", "/blog/:slug", POLICY],
    ["/docs/intro", "/docs/intro", { maxAge: 60 }],
    ["/docs/intro/more", "/docs/*", null],
  ])("answers %s with %s", (pathname, path, policy) => {
    expect(match(pathname)).toEqual({ path, policy });
  });

  it.each([["/missing"], ["/blog/%E0%A4%A"]])(
    "answers nothing for %s",
    pathname => {
      expect(match(pathname)).toBeNull();
    },
  );
});
