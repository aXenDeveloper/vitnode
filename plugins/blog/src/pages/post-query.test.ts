import { createVitNodeQueryClient } from "@vitnode/core/lib/query-client";
import { describe, expect, it, vi } from "vitest";

import { type BlogPostAnswer, blogPostQueryOptions } from "./post-query";

const ITEM: BlogPostAnswer["item"] = {
  content: { content: [], type: "doc" },
  coverImage: null,
  coverImageAlt: null,
  publishedAt: "2026-01-01T00:00:00.000Z",
  title: "Hello",
};

const content = (hidden: boolean): BlogPostAnswer["resolution"] => ({
  alternates: [],
  canonicalInternalPath: "/blog/hello",
  canonicalPath: "/blog/hello",
  hidden,
  hreflang: { languages: {} },
  isFallback: false,
  itemId: 1,
  locale: "en",
  openGraph: null,
  requestedLocale: "en",
  robots: null,
  seo: { description: null, title: null },
  type: "content",
});

describe("blogPostQueryOptions", () => {
  it.each<[string, number, BlogPostAnswer]>([
    ["a published article", 1, { item: ITEM, resolution: content(false) }],
    [
      "a redirect",
      1,
      {
        item: null,
        resolution: { location: "/blog/new", status: 308, type: "redirect" },
      },
    ],
    [
      "a hidden article only staff see",
      2,
      { item: ITEM, resolution: content(true) },
    ],
    ["a miss", 2, { item: null, resolution: { type: "not_found" } }],
  ])("loading %s twice asks the API %i time(s)", async (_, calls, answer) => {
    const queryClient = createVitNodeQueryClient();
    const queryFn = vi.fn(async () => await Promise.resolve(answer));
    const options = {
      ...blogPostQueryOptions({ locale: "en", slug: "hello" }),
      queryFn,
    };

    await queryClient.query(options);
    await queryClient.query(options);

    expect(queryFn).toHaveBeenCalledTimes(calls);
  });
});
