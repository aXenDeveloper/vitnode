// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  formatRoutePath,
  parseRoutePath,
  relativeRouteSegments,
  routeMatchKey,
  routeMatchKeyFromTanStackPath,
  toNextRoutePath,
  toTanStackRoutePath,
} from "./path";

const parse = (path: string) => {
  const result = parseRoutePath(path);

  if (!result.ok) throw new Error(result.reason);

  return result;
};

const reason = (path: string): string => {
  const result = parseRoutePath(path);

  if (result.ok) throw new Error(`"${path}" was accepted`);

  return result.reason;
};

describe("the shapes a VitNode route path represents", () => {
  it("reads a static route", () => {
    expect(parse("/example").segments).toEqual([
      { kind: "static", value: "example" },
    ]);
  });

  it("reads a nested static route", () => {
    expect(parse("/example/hello/there").segments).toEqual([
      { kind: "static", value: "example" },
      { kind: "static", value: "hello" },
      { kind: "static", value: "there" },
    ]);
  });

  it("reads a dynamic segment", () => {
    expect(parse("/example/:slug").segments).toEqual([
      { kind: "static", value: "example" },
      { kind: "param", name: "slug" },
    ]);
  });

  it("reads a dynamic segment nested under another", () => {
    expect(parse("/example/:categoryId/posts/:postId").segments).toEqual([
      { kind: "static", value: "example" },
      { kind: "param", name: "categoryId" },
      { kind: "static", value: "posts" },
      { kind: "param", name: "postId" },
    ]);
  });

  it("reads the root as no segments at all", () => {
    expect(parse("/")).toEqual({ ok: true, path: "/", segments: [] });
  });

  it("keeps dots, dashes and underscores in a static segment", () => {
    expect(parse("/example/robots.txt/a-b_c").segments).toEqual([
      { kind: "static", value: "example" },
      { kind: "static", value: "robots.txt" },
      { kind: "static", value: "a-b_c" },
    ]);
  });
});

describe("normalisation", () => {
  it("drops a trailing slash", () => {
    expect(parse("/example/hello/").path).toBe("/example/hello");
  });

  it("round-trips a path through its segments", () => {
    for (const path of ["/", "/example", "/example/:slug/comments"]) {
      expect(formatRoutePath(parse(path).segments)).toBe(path);
    }
  });

  it("reports the normalised path, not the one it was given", () => {
    expect(parse("/example/:slug/").path).toBe("/example/:slug");
  });
});

describe("paths a plugin may not declare", () => {
  it("needs a leading slash", () => {
    expect(reason("example")).toContain('must start with "/"');
  });

  it("rejects an empty path", () => {
    expect(reason("")).toContain("non-empty string");
  });

  it("rejects an empty segment", () => {
    expect(reason("/example//hello")).toContain("empty segment");
    expect(reason("//")).toContain("empty segment");
  });

  it("rejects a query string, a hash and whitespace", () => {
    expect(reason("/example?page=2")).toContain("query string");
    expect(reason("/example#top")).toContain("hash");
    expect(reason("/example/hello world")).toContain("whitespace");
  });

  it("rejects the same parameter twice", () => {
    expect(reason("/example/:id/nested/:id")).toContain('declares ":id" twice');
  });

  it("rejects a parameter that is not an identifier", () => {
    expect(reason("/example/:1st")).toContain("not a valid parameter name");
    expect(reason("/example/:")).toContain("not a valid parameter name");
  });
});

describe("static segments are lowercase", () => {
  it("accepts a lowercase path", () => {
    expect(parse("/example").path).toBe("/example");
    expect(parse("/blog/post").path).toBe("/blog/post");
    expect(parse("/example/:slug").path).toBe("/example/:slug");
  });

  it("rejects an uppercase segment, and says what to write instead", () => {
    expect(reason("/Example")).toContain("uppercase letters");
    expect(reason("/Example")).toContain('Write "example"');
    expect(reason("/BLOG/post")).toContain('Write "blog"');
    expect(reason("/blog/My-Post")).toContain('Write "my-post"');
  });

  /**
   * A parameter's name never reaches a URL - it is a variable name - so the
   * identifier rules it already had are the right ones.
   */
  it("still allows camelCase parameter names", () => {
    expect(parse("/blog/:postId").segments).toEqual([
      { kind: "static", value: "blog" },
      { kind: "param", name: "postId" },
    ]);
  });

  it("keeps naming the framework syntaxes ahead of the case rule", () => {
    // `[Slug]` and `$Slug` are uppercase *and* the wrong syntax. The syntax is
    // the useful thing to say.
    expect(reason("/example/[Slug]")).toContain("Next.js filesystem syntax");
    expect(reason("/example/$Slug")).toContain("TanStack Router syntax");
  });
});

describe("framework syntax is rejected by name", () => {
  it("rejects Next.js filesystem syntax", () => {
    expect(reason("/example/[slug]")).toContain("Next.js filesystem syntax");
    expect(reason("/example/[slug]")).toContain('write ":slug"');
  });

  it("rejects TanStack Router syntax", () => {
    expect(reason("/example/$slug")).toContain("TanStack Router syntax");
    expect(reason("/example/$slug")).toContain('write ":slug"');
  });
});

describe("route shapes this prototype defers", () => {
  it("rejects a catch-all", () => {
    expect(reason("/example/*")).toContain("catch-all");
    expect(reason("/example/[...slug]")).toContain("Next.js filesystem syntax");
  });

  it("rejects an optional segment", () => {
    expect(reason("/example/:slug?")).toContain("optional segment");
  });

  it("rejects a repeating segment", () => {
    expect(reason("/example/:slug*")).toContain("repeating segment");
    expect(reason("/example/:slug+")).toContain("repeating segment");
  });
});

describe("conversions to the frameworks that consume the manifest", () => {
  it.each([
    ["/", "/", "/"],
    ["/example", "/example", "/example"],
    ["/example/:slug", "/example/[slug]", "/example/$slug"],
    [
      "/example/:categoryId/posts/:postId",
      "/example/[categoryId]/posts/[postId]",
      "/example/$categoryId/posts/$postId",
    ],
  ])("converts %s", (path, next, tanstack) => {
    const { segments } = parse(path);

    expect(toNextRoutePath(segments)).toBe(next);
    expect(toTanStackRoutePath(segments)).toBe(tanstack);
  });

  it("is a pure function of the segments, not of the string it came from", () => {
    // The conversions never see a path, so there is no second parser to
    // disagree with the first one.
    expect(toTanStackRoutePath(parse("/example/:slug/").segments)).toBe(
      "/example/$slug",
    );
  });
});

describe("the URLs a path matches", () => {
  it("is the path itself when nothing is dynamic", () => {
    expect(routeMatchKey(parse("/example/hello").segments)).toBe(
      "/example/hello",
    );
    expect(routeMatchKey(parse("/").segments)).toBe("/");
  });

  it("does not depend on what a parameter is called", () => {
    // The two paths a plugin author writes when they have not read the other
    // plugin's routes. They match the same URLs, so the manifest has to see
    // them as one.
    expect(routeMatchKey(parse("/example/:slug").segments)).toBe(
      routeMatchKey(parse("/example/:postId").segments),
    );
  });

  it("keeps a parameter distinct from a static segment", () => {
    expect(routeMatchKey(parse("/example/:slug").segments)).not.toBe(
      routeMatchKey(parse("/example/slug").segments),
    );
  });

  it("keeps depth distinct", () => {
    expect(routeMatchKey(parse("/example/:a/:b").segments)).not.toBe(
      routeMatchKey(parse("/example/:a").segments),
    );
  });
});

describe("the URLs a TanStack path matches", () => {
  const key = routeMatchKeyFromTanStackPath;

  it("agrees with the canonical key for the same route", () => {
    expect(key("/example/hello")).toBe(
      routeMatchKey(parse("/example/hello").segments),
    );
    expect(key("/blog/$slug")).toBe(
      routeMatchKey(parse("/blog/:slug").segments),
    );
    expect(key("/")).toBe(routeMatchKey(parse("/").segments));
  });

  /**
   * The case the old exact-string comparison missed: two syntaxes, two parameter
   * names, one URL space.
   */
  it("does not depend on what a parameter is called", () => {
    expect(key("/users/$id")).toBe(key("/users/$userId"));
    expect(key("/users/$id")).toBe(
      routeMatchKey(parse("/users/:userId").segments),
    );
    expect(key("/blog/$slug/comments")).toBe(
      routeMatchKey(parse("/blog/:postId/comments").segments),
    );
  });

  it("keeps a static segment distinct from a parameter", () => {
    expect(key("/users/new")).not.toBe(key("/users/$id"));
    expect(key("/users/new")).not.toBe(
      routeMatchKey(parse("/users/:id").segments),
    );
  });

  /**
   * An index route under a layout joins to `/blog/`, which is the same URL as
   * `/blog` - so a plugin claiming `/blog` has to collide with it.
   */
  it("treats one trailing slash as formatting", () => {
    expect(key("/discover/")).toBe(key("/discover"));
    expect(key("/discover/")).toBe(routeMatchKey(parse("/discover").segments));
    expect(key("/")).toBe("/");
  });

  it("keeps a splat distinct from a parameter", () => {
    expect(key("/api/$")).toBe("/api/**");
    expect(key("/api/$")).not.toBe(key("/api/$id"));
    expect(key("/api/$")).not.toBe(routeMatchKey(parse("/api/:id").segments));
  });

  /**
   * An application's own route files are not held to the plugin lowercase rule,
   * and a router would match `/Users` and `/users` as one URL either way.
   */
  it("compares an application path case-insensitively", () => {
    expect(key("/Users/$id")).toBe(
      routeMatchKey(parse("/users/:userId").segments),
    );
  });
});

describe("relativeRouteSegments", () => {
  const relative = (parent: string, child: string) =>
    relativeRouteSegments(parse(parent).segments, parse(child).segments);

  const asPath = (parent: string, child: string) => {
    const segments = relative(parent, child);

    return segments === null ? null : formatRoutePath(segments);
  };

  it("removes the parent's prefix", () => {
    expect(asPath("/settings", "/settings/security")).toBe("/security");
    expect(asPath("/a", "/a/b/c")).toBe("/b/c");
  });

  /** A layout's index route, and a success rather than a failure. */
  it("answers an empty list when the paths are the same", () => {
    expect(relative("/settings", "/settings")).toEqual([]);
    expect(asPath("/settings", "/settings")).toBe("/");
  });

  it("carries a parameter through from the parent", () => {
    expect(asPath("/blog/:slug", "/blog/:slug/comments")).toBe("/comments");
    expect(relative("/blog/:slug", "/blog/:slug")).toEqual([]);
  });

  it("refuses a child that is not under the parent", () => {
    expect(relative("/settings", "/account")).toBeNull();
    expect(relative("/settings/security", "/settings")).toBeNull();
    expect(relative("/a", "/ab/c")).toBeNull();
  });

  /**
   * The parent named that segment, so a child that renames it reads a parameter
   * that never exists - `params.postId` would be silently `undefined`.
   */
  it("refuses a child that renames the parent's parameter", () => {
    expect(relative("/blog/:slug", "/blog/:postId/comments")).toBeNull();
  });

  it("refuses a child that swaps a static segment for a parameter", () => {
    expect(relative("/blog/:slug", "/blog/hello")).toBeNull();
    expect(relative("/blog/hello", "/blog/:slug")).toBeNull();
  });

  it("treats the root as the parent of everything", () => {
    expect(asPath("/", "/blog")).toBe("/blog");
    expect(relative("/", "/")).toEqual([]);
  });
});
