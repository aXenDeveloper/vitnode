import { describe, expect, it } from "vitest";

import { parseRoutePath } from "@/routing/path";

import type {
  RoutePathTarget,
  RoutePathTargetKind,
} from "./route-paths-validation";
import type { LocaleRoutePaths } from "./types";

import { compileRoutePaths, LocaleRoutingConfigError } from "./route-paths";
import { assertRoutePathsMatchRoutes } from "./route-paths-validation";

const target = (
  kind: RoutePathTargetKind,
  path: string,
  parentPath?: string,
): RoutePathTarget => {
  const parsed = parseRoutePath(path);
  if (!parsed.ok) throw new Error(parsed.reason);

  return {
    kind,
    owner: `"@acme/test" ${kind} "${parsed.path}"`,
    parentPath,
    path: parsed.path,
    segments: parsed.segments,
  };
};

const page = (path: string, parentPath?: string) =>
  target("page", path, parentPath);
const layout = (path: string, parentPath?: string) =>
  target("layout", path, parentPath);

const validate = (
  routePaths: LocaleRoutePaths,
  routes: readonly RoutePathTarget[],
): void => {
  assertRoutePathsMatchRoutes({
    routes,
    translator: compileRoutePaths({
      isIgnoredPath: path => path === "/admin" || path.startsWith("/admin/"),
      localePrefix: "as-needed",
      locales: ["en", "pl"],
      routePaths,
    }),
  });
};

const failureOf = (
  routePaths: LocaleRoutePaths,
  routes: readonly RoutePathTarget[],
): LocaleRoutingConfigError => {
  try {
    validate(routePaths, routes);
  } catch (error) {
    if (error instanceof LocaleRoutingConfigError) return error;

    throw error;
  }

  throw new Error("expected a LocaleRoutingConfigError");
};

const ARTICLES = [
  layout("/articles"),
  page("/articles", "/articles"),
  page("/articles/:id", "/articles"),
  page("/about"),
];

describe("assertRoutePathsMatchRoutes", () => {
  it("accepts translations that cover real routes consistently", () => {
    expect(() =>
      validate(
        {
          pl: {
            "/about": "/o-nas",
            "/articles": "/artykuly",
            "/articles/:id": "/artykuly/:id",
          },
        },
        ARTICLES,
      ),
    ).not.toThrow();
  });

  it("accepts an app with no translations at all", () => {
    expect(() => validate({}, ARTICLES)).not.toThrow();
  });

  it("accepts a translation that overlaps only a less specific route", () => {
    expect(() =>
      validate({ pl: { "/articles/new": "/a/nowy" } }, [
        page("/articles/new"),
        page("/a/:x"),
      ]),
    ).not.toThrow();
  });

  it("refuses an English path no route declares and suggests the closest ones", () => {
    const error = failureOf({ pl: { "/artciles/:id": "/artykuly/:id" } }, [
      ...ARTICLES,
      page("/artwork"),
    ]);

    expect(error.code).toBe("unknown-source-path");
    expect(error.locale).toBe("pl");
    expect(error.sourcePath).toBe("/artciles/:id");
    expect(error.translatedPath).toBe("/artykuly/:id");
    expect(error.message).toContain('Did you mean "/articles/:id"');
  });

  it("prefers suggestions from the same first segment", () => {
    const error = failureOf(
      { pl: { "/articles/:id/edit": "/artykuly/:id/e" } },
      [...ARTICLES, page("/articles/:id/editor"), page("/edit")],
    );

    expect(error.code).toBe("unknown-source-path");
    expect(error.message).toContain('"/articles/:id/editor"');
    expect(error.message).not.toContain('"/edit"');
  });

  it("refuses a parameter named differently from the route's", () => {
    const error = failureOf({ pl: { "/articles/:slug": "/artykuly/:slug" } }, [
      page("/articles/:id"),
    ]);

    expect(error.code).toBe("parameter-mismatch");
    expect(error.conflictsWith).toBe("/articles/:id");
    expect(error.message).toContain('names it ":id"');
  });

  it("refuses a translation spelled like an untranslated route", () => {
    const error = failureOf({ pl: { "/blog": "/news" } }, [
      page("/blog"),
      {
        ...page("/news"),
        kind: "host",
        owner: 'app route "src/routes/news.tsx"',
      },
    ]);

    expect(error.code).toBe("route-collision");
    expect(error.sourcePath).toBe("/blog");
    expect(error.translatedPath).toBe("/news");
    expect(error.conflictsWith).toBe("/news");
    expect(error.message).toContain('app route "src/routes/news.tsx"');
  });

  it("accepts two routes swapping their spellings", () => {
    expect(() =>
      validate({ pl: { "/a": "/b", "/b": "/a" } }, [page("/a"), page("/b")]),
    ).not.toThrow();
  });

  it("refuses a translation whose public pattern swallows a more specific untranslated route", () => {
    const error = failureOf({ pl: { "/articles/:id": "/a/:id" } }, [
      page("/articles/:id"),
      page("/a/new"),
    ]);

    expect(error.code).toBe("route-shadowed");
    expect(error.conflictsWith).toBe("/a/new");
    expect(error.message).toContain('rewrites it to "/articles/new"');
  });

  it("refuses translating a pattern that also matches a more specific untranslated route", () => {
    const error = failureOf({ pl: { "/articles/:id": "/artykuly/:id" } }, [
      page("/articles/:id"),
      page("/articles/new"),
    ]);

    expect(error.code).toBe("route-shadowed");
    expect(error.sourcePath).toBe("/articles/:id");
    expect(error.conflictsWith).toBe("/articles/new");
    expect(error.message).toContain('would become "/artykuly/new"');
    expect(error.message).toContain(
      'an identity entry "/articles/new": "/articles/new" keeps it English',
    );
  });

  it("accepts the identity entry that keeps the specific route English", () => {
    expect(() =>
      validate(
        {
          pl: {
            "/articles/:id": "/artykuly/:id",
            "/articles/new": "/articles/new",
          },
        },
        [page("/articles/:id"), page("/articles/new")],
      ),
    ).not.toThrow();
  });

  it("refuses a catch-all translation that would swallow the exact route", () => {
    const error = failureOf({ pl: { "/docs/*": "/dokumentacja/*" } }, [
      page("/docs/*"),
      page("/docs"),
    ]);

    expect(error.code).toBe("route-shadowed");
    expect(error.conflictsWith).toBe("/docs");
  });

  it("refuses an untranslated child of a translated layout", () => {
    const error = failureOf({ pl: { "/articles": "/artykuly" } }, ARTICLES);

    expect(error.code).toBe("inconsistent-layout-path");
    expect(error.sourcePath).toBe("/articles/:id");
    expect(error.conflictsWith).toBe("/articles");
    expect(error.message).toContain('"/articles/:id": "/artykuly/:id"');
  });

  it("refuses a child translated outside its translated layout's prefix", () => {
    const error = failureOf(
      { pl: { "/articles": "/artykuly", "/articles/:id": "/wpisy/:id" } },
      ARTICLES,
    );

    expect(error.code).toBe("inconsistent-layout-path");
    expect(error.sourcePath).toBe("/articles/:id");
    expect(error.translatedPath).toBe("/wpisy/:id");
  });

  it("refuses a child translated under a prefix its untranslated layout does not have", () => {
    const error = failureOf(
      { pl: { "/articles/:id": "/artykuly/:id" } },
      ARTICLES,
    );

    expect(error.code).toBe("inconsistent-layout-path");
    expect(error.message).toContain('or translate the layout "/articles" too');
  });

  it("checks every locale on its own", () => {
    const error = failureOf(
      { en: { "/about": "/about-us" }, pl: { "/abuot": "/o-nas" } },
      ARTICLES,
    );

    expect(error.code).toBe("unknown-source-path");
    expect(error.locale).toBe("pl");
  });
});
