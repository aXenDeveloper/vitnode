// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  formatRoutePath,
  parseRoutePath,
  routeMatchKey,
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

/**
 * The two syntaxes this representation exists to be independent of.
 *
 * A plugin author coming from either framework writes the one they know, so the
 * failure has to name the syntax and hand back the VitNode spelling rather than
 * saying "invalid path".
 */
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

/**
 * Deferred on purpose - inventoried in the Stage 5 notes rather than guessed at.
 *
 * Core ships two catch-alls today (`admin/content/[...slug]` and the
 * `@breadcrumb` slots), both of which are AdminCP or parallel-route machinery
 * that this stage does not cover. Accepting `/x/*` here would mean deciding what
 * it means before anything needs it.
 */
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
