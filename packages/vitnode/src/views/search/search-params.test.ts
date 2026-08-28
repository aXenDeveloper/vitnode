import { hashKey } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { searchFeedQueryKey } from "./search-feed-query";
import {
  appliedSearchTerm,
  BROWSE_SEARCH_SORT,
  defaultSearchSort,
  isSearchSort,
  MAX_SEARCH_TERM_LENGTH,
  MIN_SEARCH_TERM_LENGTH,
  normalizeSearchSort,
  normalizeSearchTerm,
  parseSearchTypes,
  SEARCH_SORT_VALUES,
  searchFeedParamsFor,
  serializeSearchTypes,
  sortForAppliedTerm,
  TERM_SEARCH_SORT,
} from "./search-params";

/**
 * What a search request means, asserted where it is decided.
 *
 * Every one of these is a pure function over data, which is the whole reason
 * they were pulled out of the two components and the two route files that used
 * to answer these questions inline. Nothing here mounts React, reaches a
 * database or builds a URL: the feed's request is `searchFeedRequest`'s job and
 * the API's own behaviour is the API's.
 */

describe("a term from a URL", () => {
  it("keeps a term somebody actually typed", () => {
    expect(normalizeSearchTerm("hono")).toBe("hono");
  });

  it("trims it", () => {
    expect(normalizeSearchTerm("  hono  ")).toBe("hono");
  });

  it.each([
    ["a bare ?search=", ""],
    ["blanks only", "   "],
    ["a tab and a newline", "\t\n"],
  ])("reads %s as no term at all", (_case, value) => {
    // `undefined` is the browse feed, which is the right page to render for a
    // parameter nobody meant.
    expect(normalizeSearchTerm(value)).toBeUndefined();
  });

  it.each([
    ["repeated, so an array", ["a", "b"]],
    ["a number", 42],
    ["an object", {}],
    ["null", null],
    ["absent", undefined],
  ])("refuses %s rather than searching for it", (_case, value) => {
    expect(normalizeSearchTerm(value)).toBeUndefined();
  });

  it("caps a term nobody typed by hand", () => {
    const term = normalizeSearchTerm("x".repeat(MAX_SEARCH_TERM_LENGTH * 4));

    expect(term).toHaveLength(MAX_SEARCH_TERM_LENGTH);
  });

  it("does not leave the cut mid-space", () => {
    const term = normalizeSearchTerm(
      `${"x".repeat(MAX_SEARCH_TERM_LENGTH - 1)} yyy`,
    );

    expect(term).toBe("x".repeat(MAX_SEARCH_TERM_LENGTH - 1));
  });
});

describe("the sort a feed takes when nobody chose one", () => {
  it("browses newest-first with no term", () => {
    // Relevance is meaningless without a term: every row scores the same.
    expect(defaultSearchSort(undefined)).toBe(BROWSE_SEARCH_SORT);
    expect(defaultSearchSort("")).toBe(BROWSE_SEARCH_SORT);
  });

  it("ranks by relevance once there is one", () => {
    expect(defaultSearchSort("hono")).toBe(TERM_SEARCH_SORT);
  });

  it("accepts every sort the API's enum accepts", () => {
    expect(SEARCH_SORT_VALUES.every(isSearchSort)).toBe(true);
  });

  it.each(["relevant", "RELEVANCE", "", 1, null, {}, undefined])(
    "refuses %s as a sort",
    value => {
      expect(isSearchSort(value)).toBe(false);
    },
  );

  it("normalises a sort that is not one back to the default", () => {
    expect(normalizeSearchSort("popularity", "hono")).toBe(TERM_SEARCH_SORT);
    expect(normalizeSearchSort("popularity")).toBe(BROWSE_SEARCH_SORT);
  });

  it("leaves a real sort alone, term or no term", () => {
    expect(normalizeSearchSort("oldest", "hono")).toBe("oldest");
    expect(normalizeSearchSort("oldest")).toBe("oldest");
  });
});

describe("the content types a feed is filtered to", () => {
  it("reads the API's comma-separated shape", () => {
    expect(parseSearchTypes("blog_post,topic")).toEqual(["blog_post", "topic"]);
  });

  it("reads the shape the controls hold in state", () => {
    expect(parseSearchTypes(["blog_post", "topic"])).toEqual([
      "blog_post",
      "topic",
    ]);
  });

  it("drops the empties a stray comma leaves behind", () => {
    // `types=,blog_post,` is three filters, two of which match nothing.
    expect(parseSearchTypes(",blog_post,,")).toEqual(["blog_post"]);
  });

  it("drops duplicates, keeping the first", () => {
    expect(parseSearchTypes("topic,blog_post,topic")).toEqual([
      "topic",
      "blog_post",
    ]);
  });

  it("trims each one", () => {
    expect(parseSearchTypes(" blog_post , topic ")).toEqual([
      "blog_post",
      "topic",
    ]);
  });

  it.each([42, null, {}, undefined, true])(
    "reads %s as no filter at all",
    value => {
      expect(parseSearchTypes(value)).toEqual([]);
    },
  );

  it("keeps only the strings out of a mixed list", () => {
    expect(parseSearchTypes([1, "topic", null, "blog_post"])).toEqual([
      "topic",
      "blog_post",
    ]);
  });

  it("keeps a type this build has no renderer for", () => {
    // A plugin can index a type the icon registry has never heard of. Dropping
    // it would silently ignore a filter the API would have honoured.
    expect(parseSearchTypes("something_new")).toEqual(["something_new"]);
  });

  it("serialises back to the query shape, or to nothing", () => {
    expect(serializeSearchTypes(["blog_post", "topic"])).toBe(
      "blog_post,topic",
    );
    expect(serializeSearchTypes([])).toBeUndefined();
    expect(serializeSearchTypes(",,")).toBeUndefined();
  });

  it("serialises to one canonical string whatever the order", () => {
    // The string is part of the query key, so this is what stops one filter
    // from being two cache entries.
    expect(serializeSearchTypes(["topic", "blog_post"])).toBe(
      serializeSearchTypes(["blog_post", "topic"]),
    );
  });
});

describe("a search request, as the shared feed's parameters", () => {
  it("browses newest-first when asked for nothing", () => {
    expect(searchFeedParamsFor()).toEqual({ sort: "newest" });
  });

  it("is exactly the browse feed with an empty box", () => {
    // `/search` with nothing typed and `/discover` are the same request over the
    // same documents, so they must be the same cache entry rather than two.
    expect(searchFeedParamsFor({ search: "" })).toEqual({ sort: "newest" });
  });

  it("switches to relevance the moment there is a term", () => {
    expect(searchFeedParamsFor({ search: "hono" })).toEqual({
      search: "hono",
      sort: "relevance",
    });
  });

  it("keeps a sort the visitor chose", () => {
    expect(searchFeedParamsFor({ search: "hono", sort: "oldest" })).toEqual({
      search: "hono",
      sort: "oldest",
    });
  });

  it("carries the type filter in the API's shape", () => {
    expect(searchFeedParamsFor({ types: ["blog_post"] })).toEqual({
      sort: "newest",
      types: "blog_post",
    });
  });

  it("omits what it has no value for, rather than setting it undefined", () => {
    // The object is part of the query key. A key holding an explicit
    // `undefined` and one holding nothing must not be able to differ.
    expect(Object.keys(searchFeedParamsFor({ types: [] }))).toEqual(["sort"]);
  });

  it("normalises rather than throwing on anything a URL can carry", () => {
    expect(
      searchFeedParamsFor({
        search: ["a", "b"],
        sort: "popularity",
        types: 42,
      }),
    ).toEqual({ sort: "newest" });
  });
});

describe("the cache entry a search lands in", () => {
  const hashOf = (params: Parameters<typeof searchFeedParamsFor>[0]) =>
    hashKey(
      searchFeedQueryKey({ locale: "en", params: searchFeedParamsFor(params) }),
    );

  it("is one entry however the caller spelled the request", () => {
    // A route loader calls this with `{ search }`; the mounted controls call it
    // with `{ search, sort, types }` off their own state. Two entries here is
    // the bug the whole module exists to prevent: the loader fills one, the
    // component reads the other, and an SSR page refetches on hydration.
    expect(hashOf({ search: "hono" })).toBe(
      hashOf({ search: "hono", sort: "relevance", types: [] }),
    );
  });

  it("is the same entry for a term with stray whitespace", () => {
    expect(hashOf({ search: " hono " })).toBe(hashOf({ search: "hono" }));
  });

  it("is the browse entry for every unusable term", () => {
    const browse = hashOf({});

    expect(hashOf({ search: "" })).toBe(browse);
    expect(hashOf({ search: "   " })).toBe(browse);
    expect(hashOf({ search: ["a"] })).toBe(browse);
  });

  it("is a different entry per term, sort, filter and language", () => {
    expect(hashOf({ search: "hono" })).not.toBe(hashOf({ search: "drizzle" }));
    expect(hashOf({ sort: "oldest" })).not.toBe(hashOf({ sort: "newest" }));
    expect(hashOf({ types: ["blog_post"] })).not.toBe(hashOf({}));
    expect(
      hashKey(
        searchFeedQueryKey({ locale: "pl", params: searchFeedParamsFor() }),
      ),
    ).not.toBe(hashOf({}));
  });

  it("does not depend on the order the filter was toggled in", () => {
    // Two visitors who ticked the same two boxes are looking at one feed.
    expect(hashOf({ types: ["a", "b"] })).toBe(hashOf({ types: ["b", "a"] }));
  });
});

describe("what a keystroke does to the feed", () => {
  it("searches once the term is long enough", () => {
    expect(appliedSearchTerm("x".repeat(MIN_SEARCH_TERM_LENGTH))).toBe(
      "x".repeat(MIN_SEARCH_TERM_LENGTH),
    );
  });

  it("goes back to browsing when the box is cleared", () => {
    expect(appliedSearchTerm("")).toBe("");
  });

  it("leaves the feed alone on the way there", () => {
    // `null` is "not yet", and it is the case that matters: backspacing through
    // a word must not flash a page of unrelated results.
    for (let length = 1; length < MIN_SEARCH_TERM_LENGTH; length += 1) {
      expect(appliedSearchTerm("x".repeat(length)), `${length}`).toBeNull();
    }
  });

  it("moves the browse default onto relevance", () => {
    expect(sortForAppliedTerm(BROWSE_SEARCH_SORT)).toBe(TERM_SEARCH_SORT);
  });

  it("never overrides a sort the visitor picked", () => {
    expect(sortForAppliedTerm("oldest")).toBe("oldest");
    expect(sortForAppliedTerm("relevance")).toBe("relevance");
  });
});
