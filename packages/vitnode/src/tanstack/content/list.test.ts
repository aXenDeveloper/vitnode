import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  contentListIdFilter,
  contentListQueryOptions,
  defineContentList,
} from "./list";

const list = defineContentList({
  defaultSort: "newest",
  filters: { category: contentListIdFilter },
  sorts: {
    newest: { order: "desc", orderBy: "publishedAt" },
    oldest: { order: "asc", orderBy: "publishedAt" },
    title: { order: "asc", orderBy: "title" },
  },
});

describe("defineContentList", () => {
  describe("parseSearch", () => {
    it.each<[string, Record<string, unknown>, Record<string, unknown>]>([
      ["keeps a page above 1", { page: "3" }, { page: 3 }],
      ["keeps a page the router parsed as a number", { page: 3 }, { page: 3 }],
      ["drops page 1", { page: "1" }, {}],
      ["drops a non-numeric page", { page: "abc" }, {}],
      ["drops a zero page", { page: "0" }, {}],
      ["drops a negative page", { page: "-2" }, {}],
      ["drops a fractional page", { page: "2.5" }, {}],
      ["drops unknown keys", { utm_source: "newsletter" }, {}],
      ["drops the default sort", { sort: "newest" }, {}],
      ["keeps another sort", { sort: "oldest" }, { sort: "oldest" }],
      ["drops an unknown sort", { sort: "views" }, {}],
      ["drops a prototype key as a sort", { sort: "toString" }, {}],
      ["drops an empty term", { q: "" }, {}],
      ["drops a whitespace term", { q: "   " }, {}],
      ["trims a term", { q: "  vite  " }, { q: "vite" }],
      [
        "keeps a term the router parsed as a number",
        { q: 2026 },
        { q: "2026" },
      ],
      ["parses a filter", { category: "3" }, { category: 3 }],
      ["drops a non-numeric filter", { category: "news" }, {}],
      ["drops a zero filter", { category: "0" }, {}],
      ["drops a zero-padded filter", { category: "03" }, {}],
    ])("%s", (_label, input, expected) => {
      expect(list.parseSearch(input)).toStrictEqual(expected);
    });

    it("truncates a long term to 256 characters", () => {
      expect(list.parseSearch({ q: "a".repeat(300) })).toStrictEqual({
        q: "a".repeat(256),
      });
    });
  });

  describe("withSearch", () => {
    it.each<[string, Record<string, unknown>, Record<string, unknown>]>([
      ["a new term", { q: "vite" }, { q: "vite" }],
      ["a cleared term", { q: undefined }, {}],
      ["a new sort", { sort: "oldest" }, { q: "react", sort: "oldest" }],
      ["a new filter", { category: 5 }, { category: 5, q: "react" }],
    ])("goes back to the first page on %s", (_label, patch, expected) => {
      expect(
        list.withSearch({ category: undefined, page: 4, q: "react" }, patch),
      ).toStrictEqual(expected);
    });

    it.each<[string, Record<string, unknown>, Record<string, unknown>]>([
      [
        "only the page changes",
        { page: 5 },
        { category: 2, page: 5, q: "react" },
      ],
      [
        "the patch repeats the term",
        { q: "react" },
        { category: 2, page: 4, q: "react" },
      ],
      [
        "the patch repeats the filter",
        { category: 2 },
        { category: 2, page: 4, q: "react" },
      ],
    ])("keeps the page when %s", (_label, patch, expected) => {
      expect(
        list.withSearch({ category: 2, page: 4, q: "react" }, patch),
      ).toStrictEqual(expected);
    });
  });

  it.each<[Record<string, unknown>, boolean]>([
    [{}, false],
    [{ page: 3 }, false],
    [{ sort: "newest" }, false],
    [{ q: "vite" }, true],
    [{ sort: "oldest" }, true],
    [{ category: 2, page: 3 }, true],
  ])("isFiltered(%o) is %s", (search, expected) => {
    expect(list.isFiltered(search)).toBe(expected);
  });

  describe("apiQuery", () => {
    it("asks for the first page in the default sort without a search", () => {
      expect(list.apiQuery({})).toStrictEqual({
        first: "12",
        order: "desc",
        orderBy: "publishedAt",
        page: "1",
      });
    });

    it("maps the page, term and sort", () => {
      expect(
        list.apiQuery({ page: 3, q: "vite", sort: "title" }),
      ).toStrictEqual({
        first: "12",
        order: "asc",
        orderBy: "title",
        page: "3",
        search: "vite",
      });
    });

    it.each([
      [undefined, 12],
      [7.9, 7],
      [0, 1],
      [-5, 1],
      [100, 50],
    ])("turns pageSize %s into %s", (pageSize, expected) => {
      const sized = defineContentList({
        defaultSort: "newest",
        pageSize,
        sorts: { newest: { order: "desc", orderBy: "publishedAt" } },
      });

      expect(sized.pageSize).toBe(expected);
      expect(sized.apiQuery({}).first).toBe(String(expected));
    });
  });

  describe("href", () => {
    it("is the bare path for the plain list", () => {
      expect(list.href("/blog", { page: 1, sort: "newest" })).toBe("/blog");
    });

    it("writes every set value in a fixed order", () => {
      expect(
        list.href("/blog", {
          sort: "oldest",
          q: "vite",
          page: 2,
          category: 3,
        }),
      ).toBe("/blog?category=3&page=2&q=vite&sort=oldest");
    });
  });
});

describe("contentListQueryOptions", () => {
  it("keys each locale and state under the prefix and fetches with them", async () => {
    const fetch = vi.fn(async () => await Promise.resolve({ edges: [] }));
    const options = contentListQueryOptions({
      fetch,
      locale: "pl",
      queryKey: ["@vitnode/blog", "posts"],
      search: { page: 2, q: "vite" },
    });

    expect(options.queryKey).toStrictEqual([
      "@vitnode/blog",
      "posts",
      { locale: "pl", page: 2, q: "vite" },
    ]);
    await expect(new QueryClient().query(options)).resolves.toStrictEqual({
      edges: [],
    });
    expect(fetch).toHaveBeenCalledExactlyOnceWith({
      locale: "pl",
      search: { page: 2, q: "vite" },
    });
  });
});
