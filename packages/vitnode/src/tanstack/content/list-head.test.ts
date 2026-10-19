import { describe, expect, it } from "vitest";

import { contentListPageHead } from "./list-head";

const locales = ["en", "pl"];

describe("contentListPageHead", () => {
  it("indexes the plain list with an alternate per locale at its path", () => {
    expect(
      contentListPageHead({
        description: "Every post",
        locales,
        pathname: "/blog",
        search: {},
        title: "Blog",
      }),
    ).toStrictEqual({
      alternates: { en: "/blog", pl: "/blog" },
      description: "Every post",
      robots: "index, follow",
      title: "Blog",
    });
  });

  it.each([
    ["a term", { q: "vite" }],
    ["a later page", { page: 2 }],
    ["a filter", { category: 3 }],
  ])("keeps a list with %s out of the index", (_label, search) => {
    expect(
      contentListPageHead({
        locales,
        pathname: "/blog",
        search,
        title: "Blog",
      }),
    ).toStrictEqual({ robots: "noindex, follow", title: "Blog" });
  });
});
