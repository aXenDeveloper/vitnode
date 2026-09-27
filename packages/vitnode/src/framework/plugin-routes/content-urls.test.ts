// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { LocaleRoutePaths } from "../../lib/i18n/types.js";
import type { PluginRouteDeclaration } from "../../routing/tree.js";
import type { PluginRouteCompilerSource } from "./compile.js";
import type { ContentUrlDefinition, ContentUrlSource } from "./content-urls.js";

import { LocaleRoutingConfigError } from "../../lib/i18n/route-paths.js";
import {
  definePluginRoutes,
  index,
  layout,
  lazy,
  page,
} from "../../routing/tree.js";
import { compilePluginRoutes } from "./compile.js";
import {
  contentTypesFromContentModule,
  ContentUrlError,
} from "./content-urls.js";
import { hostRoutePathsFromFiles } from "./host-routes.js";

const lazyPage = () =>
  lazy(async () => await Promise.resolve({ default: () => null }));

const routesOf = (
  pluginId: string,
  ...routes: PluginRouteDeclaration[]
): PluginRouteCompilerSource => ({
  pluginId,
  routes: definePluginRoutes(routes),
  routesSpecifier: `${pluginId}/routes`,
});

const contentType = ({
  deliveryPath = "",
  id = "blog.post",
  pathTemplate = "",
}: {
  deliveryPath?: string;
  id?: string;
  pathTemplate?: string;
}): ContentUrlDefinition => ({
  delivery: { enabled: deliveryPath !== "", path: deliveryPath },
  id,
  search: { enabled: pathTemplate !== "", pathTemplate },
});

const blogContent = (
  ...contentTypes: ContentUrlDefinition[]
): ContentUrlSource => ({
  contentTypes,
  pluginId: "@vitnode/blog",
  specifier: "@vitnode/blog/content",
});

const BLOG_POST = contentType({
  deliveryPath: "/blog/:slug",
  pathTemplate: "/blog/{slug}",
});

const blogPage = () =>
  routesOf("@vitnode/blog", page("/blog/:slug", { component: lazyPage() }));

const thrownBy = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }

  return undefined;
};

const failureOf = (run: () => unknown): ContentUrlError => {
  const error = thrownBy(run);

  if (error instanceof ContentUrlError) return error;

  throw new Error("expected a ContentUrlError", { cause: error });
};

describe("content URLs served by page routes", () => {
  it("accepts a content URL a plugin page serves", () => {
    expect(() =>
      compilePluginRoutes({
        contentUrls: [blogContent(BLOG_POST)],
        sources: [blogPage()],
      }),
    ).not.toThrow();
  });

  it("accepts a page whose parameter is named differently", () => {
    expect(() =>
      compilePluginRoutes({
        contentUrls: [blogContent(BLOG_POST)],
        sources: [
          routesOf(
            "@vitnode/blog",
            page("/blog/:id", { component: lazyPage() }),
          ),
        ],
      }),
    ).not.toThrow();
  });

  it("accepts the index page of a layout group", () => {
    expect(() =>
      compilePluginRoutes({
        contentUrls: [
          blogContent(contentType({ deliveryPath: "/blog/:slug" })),
        ],
        sources: [
          routesOf(
            "@vitnode/blog",
            layout("/blog/:slug", {
              component: lazyPage(),
              children: [index({ component: lazyPage() })],
            }),
          ),
        ],
      }),
    ).not.toThrow();
  });

  it("accepts a content URL an app route serves", () => {
    expect(() =>
      compilePluginRoutes({
        contentUrls: [blogContent(BLOG_POST)],
        hostRoutes: hostRoutePathsFromFiles(["_main/blog/$slug.tsx"]),
        sources: [],
      }),
    ).not.toThrow();
  });

  it("fails on a delivery.path no page serves, naming the fixes", () => {
    const error = failureOf(() =>
      compilePluginRoutes({
        contentUrls: [
          blogContent(contentType({ deliveryPath: "/blog/:slug" })),
        ],
        sources: [],
      }),
    );

    expect(error.code).toBe("content-url-without-page");
    expect(error.setting).toBe("delivery.path");
    expect(error.pattern).toBe("/blog/:slug");
    expect(error.message).toMatch(/^\[VitNode content URLs\] /);
    expect(error.message).toContain(
      'Plugin "@vitnode/blog" content type "blog.post" publishes URLs at "/blog/:slug" (delivery.path)',
    );
    expect(error.message).toContain('Add a page route at "/blog/:slug"');
    expect(error.message).toContain("point delivery.path at a path");
    expect(error.message).toContain("`delivery: { enabled: false }`");
    expect(error.message).toContain('Declared in "@vitnode/blog/content".');
  });

  it("fails on a search.pathTemplate no page serves", () => {
    const error = failureOf(() =>
      compilePluginRoutes({
        contentUrls: [
          blogContent(
            contentType({
              deliveryPath: "/blog/:slug",
              pathTemplate: "/posts/{slug}",
            }),
          ),
        ],
        sources: [blogPage()],
      }),
    );

    expect(error.code).toBe("content-url-without-page");
    expect(error.setting).toBe("search.pathTemplate");
    expect(error.pattern).toBe("/posts/{slug}");
    expect(error.message).toContain(
      'publishes URLs at "/posts/{slug}" (search.pathTemplate)',
    );
    expect(error.message).toContain('Add a page route at "/posts/:slug"');
    expect(error.message).toContain("turn search off");
  });

  it("fails on a search.pathTemplate no route path can express", () => {
    const error = failureOf(() =>
      compilePluginRoutes({
        contentUrls: [
          blogContent(contentType({ pathTemplate: "/blog/post-{slug}" })),
        ],
        sources: [blogPage()],
      }),
    );

    expect(error.code).toBe("content-url-without-page");
    expect(error.message).toContain("no page route can serve it");
  });

  it("does not count an admin-area route at the same path", () => {
    const error = failureOf(() =>
      compilePluginRoutes({
        contentUrls: [
          blogContent(contentType({ deliveryPath: "/admin/blog/:slug" })),
        ],
        sources: [
          routesOf(
            "@vitnode/blog",
            page("/admin/blog/:slug", {
              area: "admin",
              component: lazyPage(),
            }),
          ),
        ],
      }),
    );

    expect(error.code).toBe("content-url-without-page");
  });

  it("does not count a layout without a page at its own URL", () => {
    expect(
      failureOf(() =>
        compilePluginRoutes({
          contentUrls: [
            blogContent(contentType({ deliveryPath: "/blog/:slug" })),
          ],
          sources: [
            routesOf(
              "@vitnode/blog",
              layout("/blog/:slug", {
                component: lazyPage(),
                children: [page("comments", { component: lazyPage() })],
              }),
            ),
          ],
        }),
      ).code,
    ).toBe("content-url-without-page");
  });

  it("ignores content types with delivery and search off", () => {
    expect(() =>
      compilePluginRoutes({
        contentUrls: [blogContent(contentType({ id: "blog.category" }))],
        sources: [],
      }),
    ).not.toThrow();
  });

  it("checks nothing for a plugin without a content module", () => {
    expect(() =>
      compilePluginRoutes({ contentUrls: [], sources: [] }),
    ).not.toThrow();
    expect(() => compilePluginRoutes({ sources: [] })).not.toThrow();
  });
});

describe("content URLs and i18n.routePaths", () => {
  const i18nWith = (routePaths: LocaleRoutePaths) => ({
    defaultLocale: "en",
    locales: [
      { code: "en", name: "English" },
      { code: "pl", name: "Polski" },
    ],
    localePrefix: "as-needed" as const,
    routePaths,
  });

  const WPISY = { pl: { "/blog/:slug": "/wpisy/:slug" } };

  it("translates a content URL once a page serves it", () => {
    expect(() =>
      compilePluginRoutes({
        contentUrls: [blogContent(BLOG_POST)],
        i18n: i18nWith(WPISY),
        sources: [blogPage()],
      }),
    ).not.toThrow();
  });

  it("refuses the translation while no page serves the path", () => {
    const compile = () =>
      compilePluginRoutes({
        contentUrls: [blogContent(BLOG_POST)],
        i18n: i18nWith(WPISY),
        sources: [],
      });

    const error = thrownBy(compile);

    expect(error).toBeInstanceOf(LocaleRoutingConfigError);
    expect(error).toMatchObject({ code: "unknown-source-path" });
    expect(String(error)).toContain('"/blog/:slug", which is not a route');
  });
});

describe("contentTypesFromContentModule", () => {
  it("reads the contentTypes export", () => {
    expect(
      contentTypesFromContentModule(
        { contentTypes: [BLOG_POST] },
        "@vitnode/blog",
        "@vitnode/blog/content",
      ),
    ).toEqual([BLOG_POST]);
  });

  it("refuses a module without a usable contentTypes export", () => {
    for (const loaded of [
      {},
      { contentTypes: BLOG_POST },
      { contentTypes: [{ id: "blog.post" }] },
    ]) {
      expect(
        failureOf(() =>
          contentTypesFromContentModule(
            loaded,
            "@vitnode/blog",
            "@vitnode/blog/content",
          ),
        ).code,
      ).toBe("invalid-content-types-module");
    }
  });
});
