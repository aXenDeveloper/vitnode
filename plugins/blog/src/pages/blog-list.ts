import type { ContentListSearch } from "@vitnode/core/tanstack/content";

import {
  contentListIdFilter,
  defineContentList,
} from "@vitnode/core/tanstack/content";

/** The blog index's own address. */
export const BLOG_HREF = "/blog";

/**
 * The `/blog` list: newest first, 12 articles a page. `?page=2` is the whole
 * vocabulary; a legacy `?category=3` redirects to the category's own page and
 * anything else, a search term included, is ignored.
 */
export const blogPostList = defineContentList({
  defaultSort: "newest",
  filters: { category: contentListIdFilter },
  pageSize: 12,
  sorts: {
    newest: { order: "desc", orderBy: "publishedAt" },
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
): BlogListSearch => blogPostList.parseSearch({ ...input, q: undefined });

export const blogCategoryHref = (slug: string): string =>
  `${BLOG_HREF}/category/${encodeURIComponent(slug)}`;

export const blogCategoryPostList = defineContentList({
  defaultSort: "newest",
  pageSize: blogPostList.pageSize,
  sorts: {
    newest: { order: "desc", orderBy: "publishedAt" },
  },
});

export type BlogCategoryListSearch = ContentListSearch<
  (typeof blogCategoryPostList.sorts)[number]
>;

export const blogCategoryListSearch = (
  input: Record<string, unknown>,
): BlogCategoryListSearch =>
  blogCategoryPostList.parseSearch({ ...input, q: undefined });
