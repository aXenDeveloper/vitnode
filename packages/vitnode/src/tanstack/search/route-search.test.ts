import { hashKey } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { DISCOVER_FEED_PARAMS, discoverFeedQueryKey } from "./discover";
import { feedQueryKey, feedQueryOptions } from "./feed";
import {
  normalizeSearchRouteSearch,
  searchRouteFeedParams,
} from "./route-search";

const paramsFor = (input: Record<string, unknown>) =>
  searchRouteFeedParams(normalizeSearchRouteSearch(input));

const hashOf = (input: Record<string, unknown>) =>
  hashKey(feedQueryKey({ locale: "en", params: paramsFor(input) }));

describe("the route schema reads a term out of the URL", () => {
  it("ignores every other parameter in the query string", () => {
    // The sort and the type filters are controls, not URL state - see
    // `route-search.ts`. A stray `?sort=` must not become one by accident.
    expect(
      normalizeSearchRouteSearch({
        search: "hono",
        sort: "oldest",
        types: "blog_post",
      }),
    ).toEqual({ search: "hono" });
  });
});

describe("a malformed query string renders the page anyway", () => {
  it("returns an absent key rather than an explicit undefined", () => {
    // So the router has nothing to write back into the URL, and
    // `/search?search=%20` settles as `/search`.
    expect(Object.keys(normalizeSearchRouteSearch({ search: " " }))).toEqual(
      [],
    );
  });

  it("never throws, whatever it is handed", () => {
    for (const input of [
      {},
      { search: [] },
      { search: [[]] },
      { search: Number.NaN },
      { search: Symbol("hono") },
      { other: "ignored" },
    ]) {
      expect(() =>
        normalizeSearchRouteSearch(input as Record<string, unknown>),
      ).not.toThrow();
    }
  });
});

describe("the feed the route asks for", () => {
  it("is the Discover feed when the box is empty", () => {
    // `/search` with nothing typed and `/discover` are the same request over the
    // same documents. Sharing the entry is the point: a visitor arriving from
    // one has the other already in hand.
    expect(paramsFor({})).toEqual(DISCOVER_FEED_PARAMS);
    expect(hashOf({})).toBe(hashKey(discoverFeedQueryKey("en")));
  });
});

describe("the loader and the component read one query definition", () => {
  it("names the same cache entry from the same parameters", () => {
    // The loader ensures `feedQueryOptions({ locale, params })`; the mounted
    // `SearchFeedContent` is handed the same factory with the same parameters.
    // A mismatch here is an SSR page that renders, then refetches page one from
    // the browser and flickers back to a skeleton.
    const params = paramsFor({ search: "hono" });

    expect(hashKey(feedQueryOptions({ locale: "en", params }).queryKey)).toBe(
      hashKey(feedQueryKey({ locale: "en", params })),
    );
  });

  it("starts every feed from no cursor", () => {
    // `null`, spelled as the absence of a cursor: the API's schema rejects
    // `cursor=` outright, so an empty one would 400 the first page of a visit.
    expect(
      feedQueryOptions({ locale: "en", params: paramsFor({}) })
        .initialPageParam,
    ).toBeNull();
  });

  it("passes no initialData, because the loader warmed the entry", () => {
    // Two copies of page one - one in the cache, one in the options - can
    // disagree. The loader's copy is the only one.
    expect(
      feedQueryOptions({ locale: "en", params: paramsFor({ search: "hono" }) })
        .initialData,
    ).toBeUndefined();
  });
});
