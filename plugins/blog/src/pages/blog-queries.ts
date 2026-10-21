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

/**
 * One page of `/blog`, typed from the list route - `publicApi.listFields` plus
 * `locale` and the `authorId` people.
 */
export type BlogPostPage = Awaited<ReturnType<typeof fetchBlogPosts>>;

/** One `/blog` article. `locale` is the language it was served in. */
export type BlogPostCardData = BlogPostPage["edges"][number];

/**
 * One page of published articles in one locale, with their authors, for
 * `/blog` or any other page that lists them. Every locale, category and page is
 * its own entry under `blogQueryKeys.posts`.
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

/**
 * {@link blogPostsQueryOptions} as one signed-in viewer sees the page: with the
 * hidden articles they may see. Re-reads a list that came from a page rendered
 * once for everybody.
 */
export const blogViewerPostsQueryOptions = ({
  locale,
  search,
  viewerId,
}: {
  locale: string;
  search: BlogListSearch;
  viewerId: number;
}) =>
  contentListQueryOptions({
    fetch: fetchBlogPosts,
    locale,
    queryKey: [...blogQueryKeys.posts, "viewer", viewerId],
    search,
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

  return await res.json();
};

export type BlogCategories = Awaited<ReturnType<typeof fetchBlogCategories>>;

/** One category as readers see it: its id, localized name, colour and article count. */
export type BlogCategory = BlogCategories["items"][number];

/**
 * Every category's name in one locale, its colour and how many articles it
 * holds, plus the total - for the sidebar and article labels. One request for
 * the whole page, never one per article.
 */
export const blogCategoriesQueryOptions = (locale: string) =>
  queryOptions({
    queryFn: async () => await fetchBlogCategories(locale),
    queryKey: blogQueryKeys.categories(locale),
    staleTime: RECORD_STALE_TIME,
  });

/**
 * {@link blogCategoriesQueryOptions} as one signed-in viewer sees them: the
 * counts include the hidden articles they may see.
 */
export const blogViewerCategoriesQueryOptions = ({
  locale,
  viewerId,
}: {
  locale: string;
  viewerId: number;
}) =>
  queryOptions({
    queryFn: async () => await fetchBlogCategories(locale),
    queryKey: [...blogQueryKeys.categories(locale), "viewer", viewerId],
    staleTime: RECORD_STALE_TIME,
  });
