// @vitest-environment node
import { isNotFound } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import type { ContentListDefinition } from "./list-page";

import {
  contentListPage,
  contentListPageHead,
  contentListQuery,
  contentListSearch,
  nextContentListSearch,
} from "./list-page";

const recipes: ContentListDefinition = {
  delivery: {
    list: {
      enabled: true,
      filters: [
        { kind: "boolean", name: "vegetarian", values: null },
        { kind: "enum", name: "difficulty", values: ["easy", "hard"] },
        { kind: "number", name: "cookingTime", values: null },
        { kind: "reference", name: "category", values: null },
        { kind: "text", name: "cuisine", values: null },
      ],
      pageSize: 12,
      path: "/recipes",
      searchable: true,
    },
  },
};

const unsearchable: ContentListDefinition = {
  delivery: { list: { ...recipes.delivery.list, searchable: false } },
};

const thrownBy = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }

  throw new Error("Expected the list check to throw.");
};

describe("contentListSearch", () => {
  const read = contentListSearch(recipes);

  it("reads nothing from a plain URL, so the first page has one address", () => {
    expect(read({})).toStrictEqual({});
    expect(read({ page: 1 })).toStrictEqual({});
  });

  it("reads the page, the term and every declared filter", () => {
    expect(
      read({
        category: "7",
        cookingTime: "30",
        cuisine: " Italian ",
        difficulty: "easy",
        page: "3",
        q: "  risotto ",
        vegetarian: "true",
      }),
    ).toStrictEqual({
      category: 7,
      cookingTime: 30,
      cuisine: "Italian",
      difficulty: "easy",
      page: 3,
      q: "risotto",
      vegetarian: true,
    });
  });

  it("accepts the values the router already parsed from JSON", () => {
    expect(read({ page: 2, q: 404, vegetarian: false })).toStrictEqual({
      page: 2,
      q: "404",
      vegetarian: false,
    });
  });

  it("drops values it cannot use instead of failing", () => {
    expect(
      read({
        category: "-1",
        cookingTime: "soon",
        difficulty: "impossible",
        page: "two",
        q: "   ",
        utm_source: "newsletter",
        vegetarian: "yes",
      }),
    ).toStrictEqual({});
  });

  it("ignores a term when the content type has nothing to search", () => {
    expect(contentListSearch(unsearchable)({ q: "risotto" })).toStrictEqual({});
  });

  it("cuts a long term to the length the page passes on", () => {
    expect(read({ q: "a".repeat(400) }).q).toHaveLength(256);
  });
});

describe("contentListQuery", () => {
  it("asks for one page of the declared size", () => {
    expect(contentListQuery(recipes, {})).toStrictEqual({ first: "12" });
  });

  it("passes the page, the term and the filters as strings", () => {
    expect(
      contentListQuery(recipes, {
        category: 7,
        page: 2,
        q: "risotto",
        vegetarian: true,
      }),
    ).toStrictEqual({
      category: "7",
      first: "12",
      page: "2",
      search: "risotto",
      vegetarian: "true",
    });
  });

  it("passes only declared filters and no term when search is off", () => {
    expect(
      contentListQuery(unsearchable, { author: 3, q: "risotto" }),
    ).toStrictEqual({ first: "12" });
  });
});

describe("contentListPage", () => {
  const list = (currentPage: number, totalPages: number) => ({
    edges: [],
    pageInfo: { currentPage, totalPages },
  });

  it("hands back the list it was given", () => {
    const loaded = list(2, 3);

    expect(contentListPage({ list: loaded, search: { page: 2 } })).toBe(loaded);
  });

  it("answers 404 for a page past the end", () => {
    // The API clamps `?page=9` onto the last page it has.
    expect(
      isNotFound(
        thrownBy(() =>
          contentListPage({ list: list(3, 3), search: { page: 9 } }),
        ),
      ),
    ).toBe(true);
  });

  it("keeps an empty first page, which is a list with nothing in it yet", () => {
    expect(() =>
      contentListPage({ list: list(1, 0), search: {} }),
    ).not.toThrow();
  });
});

describe("contentListPageHead", () => {
  const locales = ["en", "pl"];

  it("indexes the plain first page with one alternate per language", () => {
    expect(
      contentListPageHead(recipes, {
        description: "Every recipe we cooked.",
        locales,
        search: {},
        title: "Recipes",
      }),
    ).toStrictEqual({
      alternates: { en: "/recipes", pl: "/recipes" },
      description: "Every recipe we cooked.",
      title: "Recipes",
    });
  });

  it.each([
    ["a later page", { page: 2 }],
    ["a search", { q: "risotto" }],
    ["a filter", { vegetarian: true }],
  ])("keeps %s out of the index but lets crawlers follow it", (_, search) => {
    expect(
      contentListPageHead(recipes, { locales, search, title: "Recipes" }),
    ).toStrictEqual({ robots: "noindex, follow", title: "Recipes" });
  });
});

describe("nextContentListSearch", () => {
  it("goes back to the first page when a filter changes", () => {
    expect(
      nextContentListSearch({ page: 3, q: "soup" }, { vegetarian: true }),
    ).toStrictEqual({ q: "soup", vegetarian: true });
  });

  it("keeps the term and filters when only the page changes", () => {
    expect(
      nextContentListSearch({ q: "soup", vegetarian: true }, { page: 2 }),
    ).toStrictEqual({ page: 2, q: "soup", vegetarian: true });
  });

  it("removes a key set to undefined and never writes page 1", () => {
    expect(
      nextContentListSearch({ page: 2, vegetarian: true }, { page: 1 }),
    ).toStrictEqual({ vegetarian: true });
    expect(
      nextContentListSearch(
        { q: "soup", vegetarian: true },
        {
          vegetarian: undefined,
        },
      ),
    ).toStrictEqual({ q: "soup" });
  });
});
