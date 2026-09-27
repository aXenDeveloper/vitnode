// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { LocaleRoutePaths } from "../../lib/i18n/types.js";
import type { PluginRouteDeclaration } from "../../routing/tree.js";
import type { PluginRouteCompilerSource } from "./compile.js";

import { LocaleRoutingConfigError } from "../../lib/i18n/route-paths.js";
import {
  definePluginRoutes,
  index,
  layout,
  lazy,
  page,
} from "../../routing/tree.js";
import { compilePluginRoutes } from "./compile.js";
import { hostRoutePathsFromFiles } from "./host-routes.js";
import {
  i18nFromLoadedConfig,
  localeRoutePathTargets,
} from "./locale-route-paths.js";

const lazyPage = () =>
  lazy(async () => await Promise.resolve({ default: () => null }));

const source = (
  pluginId: string,
  ...routes: PluginRouteDeclaration[]
): PluginRouteCompilerSource => ({
  pluginId,
  routes: definePluginRoutes(routes),
  routesSpecifier: `${pluginId}/routes`,
});

const example = () =>
  source(
    "@vitnode/example",
    layout("/example", {
      component: lazyPage(),
      children: [
        index({ component: lazyPage() }),
        page(":slug", { component: lazyPage() }),
      ],
    }),
    page("/admin/example", { area: "admin", component: lazyPage() }),
  );

const i18nWith = (routePaths?: LocaleRoutePaths) => ({
  defaultLocale: "en",
  locales: [
    { code: "en", name: "English" },
    { code: "pl", name: "Polski" },
  ],
  localePrefix: "as-needed" as const,
  routePaths,
});

const compileWith = (routePaths: LocaleRoutePaths, files: string[] = []) =>
  compilePluginRoutes({
    hostRoutes: hostRoutePathsFromFiles(files),
    i18n: i18nWith(routePaths),
    sources: [example()],
  });

const failureOf = (
  routePaths: LocaleRoutePaths,
  files: string[] = [],
): LocaleRoutingConfigError => {
  try {
    compileWith(routePaths, files);
  } catch (error) {
    if (error instanceof LocaleRoutingConfigError) return error;

    throw error;
  }

  throw new Error("expected a LocaleRoutingConfigError");
};

const HOST_FILES = [
  "__root.tsx",
  "_main.tsx",
  "_main/index.tsx",
  "_main/Solutions/$slug.tsx",
  "_admin/admin.core.index.tsx",
  "api/$.ts",
];

describe("compilePluginRoutes with i18n.routePaths", () => {
  it("compiles translations of real plugin and app routes", () => {
    expect(() =>
      compileWith(
        {
          pl: {
            "/example": "/przyklad",
            "/example/:slug": "/przyklad/:slug",
            "/solutions/:slug": "/rozwiazania/:slug",
          },
        },
        HOST_FILES,
      ),
    ).not.toThrow();
  });

  it("fails on an English path no route declares", () => {
    const error = failureOf({ pl: { "/exmaple": "/przyklad" } });

    expect(error.code).toBe("unknown-source-path");
    expect(error.message).toMatch(/^\[VitNode i18n\] /);
    expect(error.message).toContain(
      'Did you mean "/example" ("@vitnode/example" route "/example")',
    );
  });

  it("fails on a parameter named differently from the plugin route's", () => {
    expect(
      failureOf({
        pl: { "/example": "/przyklad", "/example/:id": "/przyklad/:id" },
      }).code,
    ).toBe("parameter-mismatch");
  });

  it("fails when a plugin translation lands on an app route", () => {
    const error = failureOf(
      {
        pl: { "/example": "/pomoc", "/example/:slug": "/pomoc/:slug" },
      },
      ["_main/pomoc.tsx"],
    );

    expect(error.code).toBe("route-collision");
    expect(error.message).toContain('app route "_main/pomoc.tsx"');
  });

  it("fails on a child left behind by its translated layout", () => {
    expect(failureOf({ pl: { "/example": "/przyklad" } }).code).toBe(
      "inconsistent-layout-path",
    );
  });

  it("surfaces the runtime diagnostics too", () => {
    expect(failureOf({ de: { "/example": "/beispiel" } }).code).toBe(
      "unknown-route-locale",
    );
  });

  it("validates nothing without an i18n config", () => {
    expect(() => compilePluginRoutes({ sources: [example()] })).not.toThrow();
  });
});

describe("localeRoutePathTargets", () => {
  const targetsOf = (files: string[]) => {
    const compiled = compilePluginRoutes({ sources: [example()] });

    return localeRoutePathTargets({
      hostRoutes: hostRoutePathsFromFiles(files),
      isIgnoredPath: path =>
        ["/admin", "/api"].some(
          prefix => path === prefix || path.startsWith(`${prefix}/`),
        ),
      manifest: compiled.manifest,
    });
  };

  it("leaves out admin-area plugin routes and app routes under /admin and /api", () => {
    expect(
      targetsOf(HOST_FILES).map(target => [target.kind, target.path]),
    ).toEqual([
      ["layout", "/example"],
      ["page", "/example"],
      ["page", "/example/:slug"],
      ["host", "/"],
      ["host", "/solutions/:slug"],
    ]);
  });

  it("links a nested plugin route to its layout", () => {
    expect(
      targetsOf([]).find(target => target.path === "/example/:slug")
        ?.parentPath,
    ).toBe("/example");
  });
});

describe("i18nFromLoadedConfig", () => {
  it("reads the i18n block of the loaded config", () => {
    const i18n = i18nWith({ pl: { "/example": "/przyklad" } });

    expect(i18nFromLoadedConfig({ vitNodeConfig: { i18n, plugins: [] } })).toBe(
      i18n,
    );
  });

  it("reads nothing from a config without a usable i18n block", () => {
    expect(i18nFromLoadedConfig({ vitNodeConfig: { plugins: [] } })).toBe(
      undefined,
    );
    expect(
      i18nFromLoadedConfig({ vitNodeConfig: { i18n: { locales: "en" } } }),
    ).toBe(undefined);
  });
});
