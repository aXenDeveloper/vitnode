import { queryOptions } from "@tanstack/react-query";
import {
  zodContentFileDescriptor,
  zodRichTextDocument,
} from "@vitnode/core/content";
import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import { RECORD_STALE_TIME } from "@vitnode/core/lib/query-freshness";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

const POST_STALE_TIME = RECORD_STALE_TIME;

const zodBlogPost = z.object({
  content: zodRichTextDocument,
  coverImage: zodContentFileDescriptor.nullable(),
  coverImageAlt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  title: z.string(),
});

const all = [manifest.id] as const;

/**
 * TanStack Query keys for the blog. Every key starts with `["@vitnode/blog"]`,
 * so `queryClient.invalidateQueries({ queryKey: blogQueryKeys.all })` refreshes
 * all of them.
 */
export const blogQueryKeys = {
  all,
  categories: (locale: string) => [...all, "categories", locale] as const,
  post: (request: { locale: string; slug: string }) =>
    [...all, "post", request] as const,
  /** Every page of every article list, in every locale. */
  posts: [...all, "posts"] as const,
};

const fetchBlogPost = async ({
  locale,
  slug,
}: {
  locale: string;
  slug: string;
}) => {
  const [resolution, detail] = await Promise.all([
    fetcher({
      plugin: manifest.id,
      method: "get",
      module: "content/blog",
      path: "/delivery/resolve/{slug}",
      args: {
        params: { slug: encodeURIComponent(slug) },
        query: { locale },
      },
    }),
    fetcher({
      plugin: manifest.id,
      method: "get",
      module: "content/blog",
      path: "/{slug}",
      args: {
        params: { slug: encodeURIComponent(slug) },
        query: { locale },
      },
    }),
  ]);

  if (resolution.status !== 200) {
    throw new Error(
      `Resolving the blog article "${slug}" answered ${resolution.status}.`,
    );
  }

  return {
    item: detail.status === 200 ? zodBlogPost.parse(await detail.json()) : null,
    resolution: await resolution.json(),
  };
};

/**
 * One article lookup: the delivery `resolution` (content, redirect or not
 * found) and the localized `item`, or `null` when the detail route did not
 * answer `200`.
 */
export type BlogPostAnswer = Awaited<ReturnType<typeof fetchBlogPost>>;

const isSharedAnswer = ({ item, resolution }: BlogPostAnswer): boolean =>
  resolution.type === "redirect" ||
  (resolution.type === "content" && !resolution.hidden && item !== null);

/**
 * Query options for the article at `/blog/:slug` in one locale, used by the
 * page's loader. The resolve and detail routes are fetched in parallel.
 *
 * A published article or a redirect is the same for every reader, so it stays
 * fresh for `RECORD_STALE_TIME` (one minute); a hidden article (only staff see it) or a miss
 * is stale at once, so the next load asks again. The result is kept out of SSR
 * dehydration, because the route's loader data already carries it to the
 * browser. The query fails when the resolve route answers anything but `200`.
 *
 * @example
 * ```ts
 * const answer = await queryClient.query(
 *   blogPostQueryOptions({ locale: "en", slug: "hello-world" }),
 * );
 * ```
 */
export const blogPostQueryOptions = (request: {
  locale: string;
  slug: string;
}) =>
  queryOptions({
    meta: LOADER_DATA_QUERY_META,
    queryFn: async () => await fetchBlogPost(request),
    queryKey: blogQueryKeys.post(request),
    staleTime: ({ state }) =>
      state.data && isSharedAnswer(state.data) ? POST_STALE_TIME : 0,
  });
