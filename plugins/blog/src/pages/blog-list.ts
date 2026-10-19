import type { ContentListSearch } from "@vitnode/core/tanstack/content";

import {
  contentListIdFilter,
  defineContentList,
} from "@vitnode/core/tanstack/content";

/** The blog index's own address. */
export const BLOG_HREF = "/blog";

/**
 * The `/blog` list: newest or oldest by publication date, one category at a
 * time, 12 cards a page. `?category=3&q=vite&sort=oldest&page=2` is the whole
 * vocabulary; anything else in the query string is ignored.
 */
export const blogPostList = defineContentList({
  defaultSort: "newest",
  filters: { category: contentListIdFilter },
  pageSize: 12,
  sorts: {
    newest: { order: "desc", orderBy: "publishedAt" },
    oldest: { order: "asc", orderBy: "publishedAt" },
  },
});

/** The `/blog` URL state, normalized. */
export type BlogListSearch = ContentListSearch<
  (typeof blogPostList.sorts)[number],
  { category: typeof contentListIdFilter }
>;

/** The route's `search` validator. */
export const blogListSearch = (
  input: Record<string, unknown>,
): BlogListSearch => blogPostList.parseSearch(input);
