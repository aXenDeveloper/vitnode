import { queryOptions } from "@tanstack/react-query";
import { RECORD_STALE_TIME } from "@vitnode/core/lib/query-freshness";
import { contentListQueryOptions } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { manifest } from "@/manifest.gen";

import type { BlogListSearch } from "./blog-list";

import { blogPostList } from "./blog-list";
import { blogQueryKeys } from "./post-query";

const fetchBlogPosts = async ({
  locale,
  search,
}: {
  locale: string;
  search: BlogListSearch;
}) => {
  const res = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/blog",
    path: "/",
    args: {
      query: {
        ...blogPostList.apiQuery(search),
        ...(search.category === undefined
          ? {}
          : { categoryId: search.category }),
        locale,
      },
    },
  });

  if (res.status !== 200) {
    throw new Error(`Loading the blog answered ${res.status}.`);
  }

  return await res.json();
};

/** One page of `/blog`, typed from the list route: `publicApi.listFields` plus `locale`. */
export type BlogPostPage = Awaited<ReturnType<typeof fetchBlogPosts>>;

/** One `/blog` card. `locale` is the language it was served in. */
export type BlogPostCardData = BlogPostPage["edges"][number];

/**
 * One page of published articles in one locale, for `/blog` or any other page
 * that lists them. Every locale, category, term, sort and page is its own
 * entry under `blogQueryKeys.posts`.
 *
 * @example
 * ```ts
 * const { edges, pageInfo } = await queryClient.query(
 *   blogPostsQueryOptions({ locale: "en", search: { category: 3 } }),
 * );
 * ```
 */
export const blogPostsQueryOptions = (request: {
  locale: string;
  search: BlogListSearch;
}) =>
  contentListQueryOptions({
    ...request,
    fetch: fetchBlogPosts,
    queryKey: blogQueryKeys.posts,
  });

const fetchBlogCategories = async (locale: string) => {
  const res = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "categories",
    path: "/",
    args: { query: { locale } },
  });

  if (res.status !== 200) {
    throw new Error(`Loading the blog categories answered ${res.status}.`);
  }

  const { items } = await res.json();

  return items;
};

/** One category as readers see it: its id, localized name and colour. */
export type BlogCategory = Awaited<
  ReturnType<typeof fetchBlogCategories>
>[number];

/**
 * Every category's name in one locale and its colour, for filters and card
 * labels. One request for the whole page, never one per article.
 */
export const blogCategoriesQueryOptions = (locale: string) =>
  queryOptions({
    queryFn: async () => await fetchBlogCategories(locale),
    queryKey: blogQueryKeys.categories(locale),
    staleTime: RECORD_STALE_TIME,
  });
