import { queryOptions } from "@tanstack/react-query";
import { zodContentFileDescriptor } from "@vitnode/core/content";
import { RECORD_STALE_TIME } from "@vitnode/core/lib/query-freshness";
import { contentListQueryOptions } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

import type { BlogListSearch } from "./blog-list";

import { blogPostList } from "./blog-list";
import { blogQueryKeys } from "./post-query";

/** One `/blog` card: exactly the blog's `publicApi.listFields`, plus `locale`. */
const zodBlogPostCard = z.object({
  categoryId: z.array(z.number()),
  coverImage: zodContentFileDescriptor.nullable(),
  coverImageAlt: z.string().nullable(),
  excerpt: z.string().nullable(),
  friendlyUrl: z.string(),
  id: z.number(),
  /** The language the card was served in - the default one on a fallback. */
  locale: z.string(),
  publishedAt: z.string().nullable(),
  title: z.string(),
});

export type BlogPostCardData = z.infer<typeof zodBlogPostCard>;

const zodBlogCategory = z.object({
  color: z.string().nullable(),
  id: z.number(),
  name: z.string(),
});

export type BlogCategory = z.infer<typeof zodBlogCategory>;

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
    queryKey: blogQueryKeys.posts,
    fetch: async ({ locale, search }) => {
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

      const { edges, pageInfo } = await res.json();

      return { edges: z.array(zodBlogPostCard).parse(edges), pageInfo };
    },
  });

/**
 * Every category's name in one locale and its colour, for filters and card
 * labels. One request for the whole page, never one per article.
 */
export const blogCategoriesQueryOptions = (locale: string) =>
  queryOptions({
    queryFn: async () => {
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

      return z.array(zodBlogCategory).parse(items);
    },
    queryKey: blogQueryKeys.categories(locale),
    staleTime: RECORD_STALE_TIME,
  });
